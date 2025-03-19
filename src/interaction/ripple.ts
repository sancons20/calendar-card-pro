/* eslint-disable import/order */
/**
 * Calendar Ripple
 *
 * A lightweight wrapper around Home Assistant's ha-ripple
 * Provides compatibility with my action system while using native HA ripple
 */

import { LitElement, css, html } from 'lit';
import * as Constants from '../config/constants';
import * as Logger from '../utils/logger';

//-----------------------------------------------------------------------------
// CALENDAR RIPPLE COMPONENT
//-----------------------------------------------------------------------------

export class CalendarRipple extends LitElement {
  // Properties
  private _disabled = false;
  private control: HTMLElement | null = null;
  private haRipple: HTMLElement | null = null;

  /**
   * Get disabled state
   */
  get disabled() {
    return this._disabled;
  }

  /**
   * Set disabled state and update attributes
   */
  set disabled(value: boolean) {
    const oldValue = this._disabled;
    this._disabled = value;
    this.requestUpdate('disabled', oldValue);
    if (value) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  /**
   * Called when the element is connected to the DOM
   */
  connectedCallback() {
    super.connectedCallback();

    try {
      // Create ha-ripple element after shadow root is initialized
      if (!customElements.get('ha-ripple')) {
        // If ha-ripple is not defined, we'll use a simpler implementation
        Logger.debug('ha-ripple not found, using fallback ripple');
        const fallbackRipple = document.createElement('div');
        fallbackRipple.className = 'fallback-ripple';
        this.appendChild(fallbackRipple);
        this.haRipple = fallbackRipple;
      } else {
        // Create and append ha-ripple element
        this.haRipple = document.createElement('ha-ripple');
        this.appendChild(this.haRipple);
        Logger.debug('ha-ripple element created successfully');
      }

      // Attach to control if already available
      if (this.control) {
        this.attachRipple(this.control);
      }
    } catch (e) {
      Logger.error('Error creating ripple element:', e);
    }
  }

  /**
   * Attach this ripple to a control element
   * Handles both the ha-ripple attachment and my custom event forwarding
   */
  attach(control: HTMLElement) {
    try {
      Logger.debug('Attaching ripple to control element');
      this.control = control;
      this.attachRipple(control);

      // Listen for ha-ripple action events and forward them as mdw:action
      control.addEventListener('click', this._handleClick);
    } catch (e) {
      Logger.error('Error attaching ripple:', e);
    }
  }

  /**
   * Detach this ripple from its control element
   * Removes event listeners and detaches the ha-ripple
   */
  detach() {
    try {
      if (!this.control) return;

      // Remove the click handler
      this.control.removeEventListener('click', this._handleClick);

      // Detach the ha-ripple
      if (this.haRipple && 'detach' in this.haRipple) {
        try {
          (this.haRipple as unknown as { detach: () => void }).detach();
        } catch (e) {
          Logger.warn('Failed to detach ha-ripple:', e);
        }
      }

      this.control = null;
    } catch (e) {
      Logger.error('Error detaching ripple:', e);
    }
  }

  /**
   * Handle click events and dispatch as mdw:action events
   * Bridges the gap between ha-ripple and my action system
   * @private
   */
  private _handleClick = (event: Event) => {
    try {
      Logger.debug('Click detected, forwarding as mdw:action');

      // Forward the click as an mdw:action event
      const actionEvent = new CustomEvent('mdw:action', {
        bubbles: true,
        composed: true,
        detail: { source: 'click', originalEvent: event },
      });

      if (this.control) {
        this.control.dispatchEvent(actionEvent);
      } else {
        this.dispatchEvent(actionEvent);
      }
    } catch (e) {
      Logger.error('Error handling click event:', e);
    }
  };

  /**
   * Attach the ripple to the given control element
   * @private
   */
  private attachRipple(control: HTMLElement) {
    try {
      if (this.haRipple && 'attach' in this.haRipple) {
        (this.haRipple as unknown as { attach: (element: HTMLElement) => void }).attach(control);
        Logger.debug('ha-ripple attached successfully');
      } else if (this.haRipple) {
        // Fallback for when ha-ripple doesn't have attach method
        Logger.debug('Using fallback ripple attachment');
      }
    } catch (e) {
      Logger.warn('Failed to attach ha-ripple:', e);
    }
  }

  /**
   * Renders the component's template
   * @returns Lit HTML template result
   */
  render() {
    return html`<slot></slot>`;
  }

  /**
   * Component styles
   */
  static styles = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      overflow: hidden;
      border-radius: inherit;
      pointer-events: none;
      z-index: 1;

      --md-ripple-hover-opacity: var(
        --ha-ripple-hover-opacity,
        ${Constants.UI.RIPPLE_OPACITY.HOVER}
      );
      --md-ripple-pressed-opacity: var(
        --ha-ripple-pressed-opacity,
        ${Constants.UI.RIPPLE_OPACITY.PRESSED}
      );
      --md-ripple-hover-color: var(--ha-ripple-color, var(--primary-color));
      --md-ripple-pressed-color: var(--ha-ripple-color, var(--primary-color));
    }

    .fallback-ripple {
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
  `;
}

//-----------------------------------------------------------------------------
// ELEMENT REGISTRATION
//-----------------------------------------------------------------------------

// Register the custom element with error handling
try {
  // Add a check before registering the element
  // This prevents a "Failed to execute 'define'" error when multiple cards exist on a page
  if (!customElements.get('calendar-ripple')) {
    customElements.define('calendar-ripple', CalendarRipple);
    Logger.info('Registered calendar-ripple component successfully');
  } else {
    Logger.debug('calendar-ripple component already registered');
  }
} catch (e) {
  Logger.error('Failed to register calendar-ripple component:', e);
}

// Make sure TypeScript knows about our component
declare global {
  interface HTMLElementTagNameMap {
    'calendar-ripple': CalendarRipple;
  }
}
