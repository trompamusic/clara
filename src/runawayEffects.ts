import { hijackEffects } from "stop-runaway-react-effects";

// Increase stop-runaway-react-effects threshold from 60/second.
//
// JSON-LD traversal dispatches one graph action per fetched resource,
// and every dispatch re-renders Connect(Companion) and re-runs.
// Fast traversal can trigger the guard even though it's not runaway.
hijackEffects({ callCount: 300, timeLimit: 1000 });
