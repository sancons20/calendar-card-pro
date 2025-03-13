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
   * Called when the element is added to the DOM
   * Creates the ha-ripple element and attaches it if a control is available
   */
  connectedCallback() {
    super.connectedCallback();

    // Create ha-ripple element
    this.haRipple = document.createElement('ha-ripple');
    this.appendChild(this.haRipple);

    // Attach to control if already available
    if (this.control) {
      this.attachRipple(this.control);
    }
  }

  /**
   * Attach this ripple to a control element
   * Handles both the ha-ripple attachment and my custom event forwarding
   */
  attach(control: HTMLElement) {
    this.control = control;
    this.attachRipple(control);

    // Listen for ha-ripple action events and forward them as mdw:action
    control.addEventListener('click', this._handleClick);
  }

  /**
   * Detach this ripple from its control element
   * Removes event listeners and detaches the ha-ripple
   */
  detach() {
    if (!this.control) return;

    // Remove the click handler
    this.control.removeEventListener('click', this._handleClick);

    // Detach the ha-ripple
    if (this.haRipple && 'detach' in this.haRipple) {
      try {
        (this.haRipple as { detach: () => void }).detach();
      } catch (e) {
        Logger.warn('Failed to detach ha-ripple:', e);
      }
    }

    this.control = null;
  }

  /**
   * Handle click events and dispatch as mdw:action events
   * Bridges the gap between ha-ripple and my action system
   * @private
   */
  private _handleClick = () => {
    // Forward the click as an mdw:action event
    const actionEvent = new CustomEvent('mdw:action', {
      bubbles: true,
      composed: true,
      detail: { source: 'click' },
    });

    if (this.control) {
      this.control.dispatchEvent(actionEvent);
    } else {
      this.dispatchEvent(actionEvent);
    }
  };

  /**
   * Attach the ripple to the given control element
   * @private
   */
  private attachRipple(control: HTMLElement) {
    if (this.haRipple && 'attach' in this.haRipple) {
      try {
        (this.haRipple as { attach: (element: HTMLElement) => void }).attach(control);
      } catch (e) {
        Logger.warn('Failed to attach ha-ripple:', e);
      }
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
  }
} catch (e) {
  Logger.warn('Could not register calendar-ripple:', e);
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-ripple': CalendarRipple;
  }
}
