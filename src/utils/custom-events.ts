/**
 * Type definitions for custom events used by Material Web components
 */

export interface MDWActionEventDetail {
  source?: 'click' | 'keydown' | 'holdEnd';
}

export interface MDWActionEvent extends CustomEvent<MDWActionEventDetail> {
  type: 'mdw:action';
}

// Extend the HTMLElementEventMap to include our custom events
declare global {
  interface HTMLElementEventMap {
    'mdw:action': MDWActionEvent;
  }
}
