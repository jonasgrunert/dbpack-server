import { Machine, interpret } from "xstate";
import { MachineHandler } from "Messages";

const PENDING = "PENDING";
const FAILURE = "FAILURE";
const SUCCESS = "SUCCESS";

const defaultActions = {
  [FAILURE]: "inactive",
  [SUCCESS]: "active"
};

export function createMachine(): MachineHandler {
  const stateMachine = Machine({
    id: "socketState",
    initial: "inactive",
    states: {
      inactive: {
        on: {
          [PENDING]: "pending"
        }
      },
      pending: {
        on: defaultActions
      },
      active: {
        on: {
          [PENDING]: "pending"
        }
      }
    }
  });
  const machine = interpret(stateMachine)
    .onTransition(state => console.info(`Current state:  ${state.value}`))
    .start();
  return {
    getState() {
      return machine.state;
    },
    isActive() {
      return machine.state.value === "active";
    },
    isInactive() {
      return machine.state.value === "inactive";
    },
    isPending() {
      return machine.state.value === "pending";
    },
    setPending() {
      machine.send(PENDING);
    },
    success() {
      machine.send(SUCCESS);
    },
    failure() {
      machine.send(FAILURE);
    }
  };
}
