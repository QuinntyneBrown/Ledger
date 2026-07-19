import { DecimalPipe } from "@angular/common";
import { Component, input } from "@angular/core";

@Component({
  selector: "ledger-progress-ring",
  standalone: true,
  template: `<div class="au-gauge goal-gauge" role="img" [attr.aria-label]="label()">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="au-gauge-track" cx="60" cy="60" r="52" stroke-width="9"></circle>
      <circle class="au-gauge-arc" cx="60" cy="60" r="52" stroke-width="9"
        stroke-dasharray="326.73" [attr.stroke-dashoffset]="dashOffset()"></circle>
    </svg>
    <div class="au-gauge-center">
      <div class="au-gauge-value">{{ value() | number: "1.0-0" }}%</div>
      <div class="au-gauge-caption">{{ caption() }}</div>
    </div>
  </div>`,
  imports: [DecimalPipe],
})
export class ProgressRingComponent {
  value = input.required<number>();
  label = input.required<string>();
  caption = input("to goal");
  dashOffset(): number {
    return 326.73 * (1 - Math.max(0, Math.min(100, this.value())) / 100);
  }
}

@Component({
  selector: "ledger-empty-state",
  standalone: true,
  template: `<section class="au-empty">
    <div class="au-empty-art" aria-hidden="true"><svg class="au-icon"><use href="#i-scale" /></svg></div>
    <h2 class="au-empty-title">{{ title() }}</h2>
    <p class="au-empty-text">{{ message() }}</p>
    <ng-content />
  </section>`,
})
export class EmptyStateComponent {
  title = input.required<string>();
  message = input.required<string>();
}
