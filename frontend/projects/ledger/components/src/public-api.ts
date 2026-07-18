import { DecimalPipe } from "@angular/common";
import { Component, input } from "@angular/core";

@Component({
  selector: "ledger-progress-ring",
  standalone: true,
  template: `<div class="progress-ring" role="img" [attr.aria-label]="label()">
    <strong>{{ value() | number: "1.0-0" }}%</strong
    ><span>{{ caption() }}</span>
  </div>`,
  imports: [DecimalPipe],
})
export class ProgressRingComponent {
  value = input.required<number>();
  label = input.required<string>();
  caption = input("to goal");
}

@Component({
  selector: "ledger-empty-state",
  standalone: true,
  template: `<section class="empty">
    <div class="empty__icon" aria-hidden="true">✦</div>
    <h2>{{ title() }}</h2>
    <p>{{ message() }}</p>
    <ng-content />
  </section>`,
})
export class EmptyStateComponent {
  title = input.required<string>();
  message = input.required<string>();
}
