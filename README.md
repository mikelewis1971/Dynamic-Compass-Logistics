# Dynamic-Compass-Logistics

How to Use and Explore This Training Tool
Run the Simulation:

Open your terminal, navigate to the file directory, and execute:
node dynamicCompassTrainingTool.js

Observe the logged output. Each time step prints the flows between nodes and updated inventories. This illustrates how local decisions (based on the computed phi values) drive the overall network balance.

Examine Event-Driven Behavior:

The simulation emits events (e.g., stepEnd, edgeDisrupted) that you can listen to, debug, or extend. This mimics real-world decentralized systems where nodes operate based on local information.

Simulate Disruptions and Adjustments:

After a few seconds, a disruption is simulated on one edge (nodeC → nodeD). Notice how the network adapts as flows re-balance after the edge capacity returns.

Uncomment the manual adjustment function to experiment with real-time changes to inventory levels. This teaches you how dynamic inputs impact the simulation.

Extend the Tool:

Use the modular design as a basis for expanding the simulation. You might add a REST API to change parameters on the fly, a graphical dashboard (using front-end tools like React or D3.js), or even machine learning modules to forecast future disruptions.

Everyday & Disaster Logistics:

While the sample scenario here shows a mix of surplus and deficit nodes (applicable to both day-to-day operations and emergency response), you can adjust initial inventories, capacities, and connectivity to model a variety of real-world situations.

This robust training tool thus provides both a theoretical foundation and a practical, hands-on example of how the Dynamic Compass Logistics framework can be implemented in Node.js, inviting further exploration and development across disciplines. Enjoy learning and experimenting!
