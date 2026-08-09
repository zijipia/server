# RFC 001: Optional Event Payload in EventBus

## Status
Proposed

## Context & Problem
Previously, the `EventBus.emit(event, payload)` method signature required passing a payload argument, even for events that did not have any associated payload data (where payload is of type `void` or `undefined`). 

This resulted in verbose and unnatural code where developers had to explicitly pass `undefined` or `any` placeholders:
```typescript
events.emit("app:boot", undefined);
```

When trying to support optional payloads by modifying `EventBus.emit` signature, under `strict` TypeScript compiler settings, `SimpleEventBus.emit` would fail to compile unless its implementation parameter was also updated to be optional, causing contract violations.

## Proposed Change
1. Modify `EventBus.emit` signature to make the `payload` parameter optional:
```typescript
emit<Event extends EventKey<EM>>(event: Event, payload?: EventPayload<EM, Event>): Promise<void>;
```
2. Update `SimpleEventBus.emit` to match:
```typescript
async emit<Event extends EventKey<EM>>(event: Event, payload?: EventPayload<EM, Event>): Promise<void>;
```
3. Update `SimpleEventBus.emit` execution logic to properly forward the optional payload (potentially `undefined`) to listeners and clean up `once` listeners before invoking them, ensuring robust exception behavior.

## Impact & Backward Compatibility
This is a backward-compatible change at runtime, as passing a payload remains fully supported. In TypeScript, code that formerly passed `undefined` explicitly is still valid, while code that omits the payload is now correctly typed and accepted.
