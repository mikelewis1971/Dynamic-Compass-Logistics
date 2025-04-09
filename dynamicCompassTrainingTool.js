/**
 * Dynamic Compass Logistics Training Tool
 * =========================================
 * 
 * This tool demonstrates how to implement the Dynamic Compass Logistics framework in Node.js.
 * It models a network of nodes (e.g., warehouses, retail outlets) linked by edges (transport routes)
 * while enforcing key axioms:
 *   - Conservation of goods: Inventory balance (inflows - outflows = change in inventory)
 *   - Capacity limits: Flow is bounded by source supply, destination demand, and route capacity
 *   - Dynamic routing: Local "compass" (phi) decision making drives self-balancing flows
 *
 * This training tool is meant for both disaster response scenarios and everyday logistics.
 *
 * Usage:
 *    node dynamicCompassTrainingTool.js
 *
 * Feel free to modify the parameters, functions, or simulation loop to experiment with the concept.
 */

// Node.js built-in event emitter allows us to implement asynchronous event-based behavior.
const EventEmitter = require('events');

// ******************  Classes & Core Functions  ****************** //

// The Node class models a supply/demand location in our network.
class Node {
  /**
   * @param {string} id - Identifier for the node.
   * @param {number} initialInventory - Starting inventory for the node.
   * @param {number} targetInventory - Target or optimal inventory level.
   */
  constructor(id, initialInventory, targetInventory) {
    this.id = id;
    this.inventory = initialInventory;  // Current stock level.
    this.targetInventory = targetInventory;  // Ideal level for stability.
    this.incomingFlows = 0;  // Accumulated inbound goods (reset every time step).
    this.outgoingFlows = 0;  // Accumulated outbound goods (reset every time step).
    this.neighbors = [];    // Array of objects: { node: Node, edge: Edge }.
  }

  /**
   * Computes the node's potential: a ratio of current inventory to target inventory.
   * Phi > 1 indicates surplus; Phi < 1 indicates a deficit.
   * @returns {number} The computed phi value.
   */
  computePhi() {
    return this.inventory / this.targetInventory;
  }

  /**
   * Resets the incoming and outgoing flow counters.
   */
  resetFlows() {
    this.incomingFlows = 0;
    this.outgoingFlows = 0;
  }
}

// The Edge class models a transport route between two nodes with a capacity limit.
class Edge {
  /**
   * @param {Node} from - Source node.
   * @param {Node} to - Destination node.
   * @param {number} capacity - Maximum units that can be transported in one time step.
   */
  constructor(from, to, capacity) {
    this.from = from;
    this.to = to;
    this.capacity = capacity;
  }

  /**
   * Compute the flow between the source and destination nodes.
   * The flow is the minimum of:
   *   - the supply at the source,
   *   - the demand (gap) at the destination,
   *   - the capacity of the edge.
   * @returns {number} The flow amount.
   */
  computeFlow() {
    // Supply available at the source node.
    const sourceSupply = this.from.inventory;

    // Demand is how many units are needed to reach the target at the destination.
    const destinationDeficit = Math.max(this.to.targetInventory - this.to.inventory, 0);

    // The amount that can be moved in this step is constrained by all three.
    return Math.min(sourceSupply, destinationDeficit, this.capacity);
  }
}

/**
 * Connects two nodes by creating bidirectional edges.
 * Each connection is represented by an edge from A to B and another from B to A.
 * @param {Node} nodeA 
 * @param {Node} nodeB 
 * @param {number} capacityAB - Capacity from nodeA to nodeB.
 * @param {number} capacityBA - Capacity from nodeB to nodeA.
 */
function connectNodes(nodeA, nodeB, capacityAB, capacityBA) {
  const edgeAB = new Edge(nodeA, nodeB, capacityAB);
  const edgeBA = new Edge(nodeB, nodeA, capacityBA);
  nodeA.neighbors.push({ node: nodeB, edge: edgeAB });
  nodeB.neighbors.push({ node: nodeA, edge: edgeBA });
  return [edgeAB, edgeBA];
}

// ******************  Simulation Class  ****************** //

/**
 * The Simulation class orchestrates the decentralized logistics simulation.
 * It handles time-stepped updates, event emission, and disruption simulation.
 */
class Simulation extends EventEmitter {
  /**
   * @param {Array<Node>} nodes - Array of nodes in the network.
   * @param {number} timeStepMS - Time per simulation step in milliseconds.
   */
  constructor(nodes, timeStepMS = 1000) {
    super();
    this.nodes = nodes;
    this.timeStepMS = timeStepMS;
    this.currentStep = 0;
    this.simulationInterval = null;
  }

  /**
   * Runs one time step of the simulation:
   *   1. Resets all node flows.
   *   2. Iterates through each node to compute flows over its edges.
   *   3. Updates each node's inventory based on incoming and outgoing flows.
   *   4. Emits events so that external functions can hook in (e.g., for visualization or logging).
   */
  step() {
    this.currentStep++;
    this.emit('stepStart', { step: this.currentStep });

    // Reset flow accumulators.
    this.nodes.forEach(node => node.resetFlows());

    // Calculate flows for each connection.
    let flows = []; // For logging details about flows.
    this.nodes.forEach(node => {
      node.neighbors.forEach(({ node: neighbor, edge }) => {
        // Only send flow if there's a surplus at the source (phi > 1) and a deficit at the neighbor (phi < 1).
        const phiDifference = node.computePhi() - neighbor.computePhi();
        if (phiDifference > 0) {
          const flow = edge.computeFlow();
          if (flow > 0) {
            node.outgoingFlows += flow;
            neighbor.incomingFlows += flow;
            flows.push({ from: node.id, to: neighbor.id, amount: flow });
          }
        }
      });
    });

    // Update node inventories based on computed flows.
    this.nodes.forEach(node => {
      node.inventory = node.inventory + node.incomingFlows - node.outgoingFlows;
    });

    // Emit an event with the details of the flows and states.
    this.emit('stepEnd', {
      step: this.currentStep,
      flows,
      nodes: this.nodes.map(n => ({
        id: n.id,
        inventory: n.inventory,
        phi: n.computePhi()
      }))
    });
  }

  /**
   * Starts the simulation with a fixed time step.
   */
  start() {
    if (this.simulationInterval) return; // Already running.
    this.simulationInterval = setInterval(() => this.step(), this.timeStepMS);
    this.emit('simulationStarted', { timeStepMS: this.timeStepMS });
  }

  /**
   * Stops the simulation.
   */
  stop() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      this.emit('simulationStopped');
    }
  }

  /**
   * Introduces a disruption on a specific edge by setting its capacity to zero.
   * This can be used to simulate route failures (e.g., due to natural disasters).
   * @param {Edge} edge - The edge to disrupt.
   * @param {number} durationMS - Duration of the disruption in milliseconds.
   */
  simulateEdgeDisruption(edge, durationMS) {
    const originalCapacity = edge.capacity;
    edge.capacity = 0;
    this.emit('edgeDisrupted', { edge, durationMS });
    // Restore capacity after the disruption period.
    setTimeout(() => {
      edge.capacity = originalCapacity;
      this.emit('edgeRestored', { edge });
    }, durationMS);
  }
}

// ******************  Training Tool Setup & Usage  ****************** //

// Create sample nodes representing different logistic hubs (warehouses, retail outlets, etc.).
// These sample values work both for everyday logistics and for "disaster" scenarios.
const nodeA = new Node("A", 200, 150);  // Surplus node
const nodeB = new Node("B", 80, 150);   // Deficit node (needs replenishment)
const nodeC = new Node("C", 130, 150);  // Near equilibrium node
const nodeD = new Node("D", 50, 150);   // High-need node

// Establish connections between nodes. Each direction can have a different capacity.
connectNodes(nodeA, nodeB, 40, 20);
connectNodes(nodeA, nodeC, 30, 30);
connectNodes(nodeB, nodeC, 20, 20);
connectNodes(nodeC, nodeD, 25, 25);
connectNodes(nodeB, nodeD, 15, 10);

// Combine all nodes into a network array.
const networkNodes = [nodeA, nodeB, nodeC, nodeD];

// Create a simulation instance with a chosen time step (e.g., 1 second per step).
const simulation = new Simulation(networkNodes, 1000);

// ******************  Event Listeners for Logging & Exploration  ****************** //

// Log simulation start.
simulation.on('simulationStarted', (data) => {
  console.log(`\nSimulation started. Time step: ${data.timeStepMS}ms\n`);
});

// Log details at the start of each simulation step.
simulation.on('stepStart', (data) => {
  console.log(`--- Step ${data.step} Starting ---`);
});

// Log the flows and the node states at the end of each step.
simulation.on('stepEnd', (data) => {
  console.log(`Step ${data.step} completed:`);
  data.flows.forEach(flow => {
    console.log(`  Flow: ${flow.from} -> ${flow.to} | Amount: ${flow.amount.toFixed(2)}`);
  });
  data.nodes.forEach(node => {
    console.log(`  Node ${node.id}: Inventory = ${node.inventory.toFixed(2)}, Phi = ${node.phi.toFixed(2)}`);
  });
  console.log("");
});

// Log when an edge is disrupted.
simulation.on('edgeDisrupted', ({ edge, durationMS }) => {
  console.log(`*** Disruption: Edge ${edge.from.id} -> ${edge.to.id} capacity set to 0 for ${durationMS}ms ***`);
});

// Log when an edge is restored.
simulation.on('edgeRestored', ({ edge }) => {
  console.log(`*** Restoration: Edge ${edge.from.id} -> ${edge.to.id} capacity restored ***`);
});

// ******************  Interactive Training Methods  ****************** //

// For demonstration, start the simulation.
simulation.start();

// After a few seconds, simulate a disruption to illustrate how the network responds to failures.
// (e.g., a road closure or communication breakdown that might occur during a disaster)
setTimeout(() => {
  // Let’s disrupt the edge from nodeC to nodeD for 5 seconds.
  const edgeToDisrupt = nodeC.neighbors.find(conn => conn.node.id === "D").edge;
  simulation.simulateEdgeDisruption(edgeToDisrupt, 5000);
}, 5000);

/**
 * Additional Methods for Exploration:
 *
 * 1. manualAdjustment(nodeId, delta):
 *    Allows the user to manually adjust the inventory of a node during simulation.
 *    Example: Increase node B’s inventory by 50 units.
 *
 * 2. stopSimulation():
 *    Stops the simulation so that you can analyze the steady-state.
 *
 * 3. addNewNode():
 *    Illustrates how a new node can be dynamically added to the network.
 *
 * Further development can include REST endpoints, a WebSocket real-time dashboard,
 * or integrations with external IoT data sources for a fully interactive training tool.
 */

// Example of manual inventory adjustment (uncomment to use):
// function manualAdjustment(nodeId, delta) {
//   const node = networkNodes.find(n => n.id === nodeId);
//   if (node) {
//     node.inventory += delta;
//     console.log(`Manual adjustment: Node ${nodeId} inventory changed by ${delta} units.`);
//   } else {
//     console.log(`Node ${nodeId} not found.`);
//   }
// }
// To test a manual adjustment, you might call manualAdjustment("B", 50);

// You can stop the simulation after a set period, for instance after 20 seconds:
// setTimeout(() => {
//   simulation.stop();
//   console.log("Simulation stopped by user.");
// }, 20000);
