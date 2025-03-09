import { css, html, LitElement } from 'lit';

/**
 * Calendar Ripple - A lightweight wrapper around Home Assistant's ha-ripple
 */
export class CalendarRipple extends LitElement {
  // Replace @property decorator with standard property + getter/setter
  private _disabled = false;

  // Standard getter/setter instead of decorator
  get disabled() {
    return this._disabled;
  }

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

  private control: HTMLElement | null = null;

  connectedCallback() {
    super.connectedCallback();

    // Create ha-ripple element
    const haRipple = document.createElement('ha-ripple');
    this.appendChild(haRipple);

    // Attach to control if already available
    if (this.control) {
      this.attachRipple(this.control);
    }
  }

  attach(control: HTMLElement) {
    this.control = control;
    this.attachRipple(control);
  }

  private attachRipple(control: HTMLElement) {
    const haRipple = this.querySelector('ha-ripple');
    if (haRipple && 'attach' in haRipple) {
      try {
        (haRipple as any).attach(control);
      } catch (e) {
        console.warn('Failed to attach ha-ripple:', e);
      }
    }
  }

  detach() {
    if (!this.control) return;

    const haRipple = this.querySelector('ha-ripple');
    if (haRipple && 'detach' in haRipple) {
      try {
        (haRipple as any).detach();
      } catch (e) {
        console.warn('Failed to detach ha-ripple:', e);
      }
    }

    this.control = null;
  }

  render() {
    return html`<slot></slot>`;
  }

  static styles = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      overflow: hidden;
      border-radius: inherit;
      --md-ripple-hover-opacity: var(--ha-ripple-hover-opacity, 0.08);
      --md-ripple-pressed-opacity: var(--ha-ripple-pressed-opacity, 0.12);
      --md-ripple-hover-color: var(--ha-ripple-hover-color,var(--ha-ripple-color, var(--secondary-text-color));
      --md-ripple-pressed-color: var(--ha-ripple-pressed-color,var(--ha-ripple-color, var(--secondary-text-color)));
    }
  `;
}

// Register the custom element with error handling
try {
  customElements.define('calendar-ripple', CalendarRipple);
} catch (e) {
  console.warn('Could not register calendar-ripple:', e);
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-ripple': CalendarRipple;
  }
}
