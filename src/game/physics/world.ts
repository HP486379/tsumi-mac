import Matter from "matter-js";
import { WIDTH, HEIGHT, DEVICES, type Device } from "../../data/devices";
export function createWorld() {
  const engine = Matter.Engine.create({
    enableSleeping: true,
    positionIterations: 8,
    velocityIterations: 6,
  });
  engine.gravity.y = 0.8;
  const walls = [
    Matter.Bodies.rectangle(-20, HEIGHT / 2, 40, HEIGHT * 3, {
      isStatic: true,
    }),
    Matter.Bodies.rectangle(WIDTH + 20, HEIGHT / 2, 40, HEIGHT * 3, {
      isStatic: true,
    }),
    Matter.Bodies.rectangle(WIDTH / 2, HEIGHT + 20, WIDTH + 80, 40, {
      isStatic: true,
    }),
  ];
  Matter.Composite.add(engine.world, walls);
  return engine;
}
export function deviceBody(device: Device = DEVICES[0], x = 180, y = 80) {
  const body = Matter.Bodies.rectangle(
    x,
    y,
    device.cols * 36 - 0.6,
    device.rows * 36 - 0.6,
    {
      friction: device.friction,
      frictionStatic: 0.8,
      frictionAir: 0.018,
      restitution: 0.045,
      sleepThreshold: 50,
      label: device.id,
    },
  );
  Matter.Body.setMass(body, device.mass);
  return body;
}
