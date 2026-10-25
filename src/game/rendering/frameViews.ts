import type { RenderState } from './renderer';

export interface RenderView { draw(state: RenderState): void }

/** Fan-out only: no simulation, clocks, input, or additional animation loop. */
export class FrameViews {
  lastState: RenderState | null = null;
  private secondary: RenderView | null = null;
  constructor(private readonly primary: RenderView) {}

  attach(view: RenderView | null): void {
    this.secondary = view;
    if (view && this.lastState) view.draw(this.lastState);
  }

  draw(state: RenderState): void {
    this.lastState = state;
    // The original view always gets first use of the frame budget.
    this.primary.draw(state);
    this.secondary?.draw(state);
  }
}
