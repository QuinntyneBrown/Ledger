import { TestBed } from '@angular/core/testing';
import { ProgressRingComponent } from './public-api';

// Traces to: L2-063, L2-065, L2-080
describe('ProgressRingComponent',()=>{it('exposes an accessible label and value',async()=>{await TestBed.configureTestingModule({imports:[ProgressRingComponent]}).compileComponents();const fixture=TestBed.createComponent(ProgressRingComponent);fixture.componentRef.setInput('value',42);fixture.componentRef.setInput('label','42 percent toward goal');fixture.detectChanges();expect(fixture.nativeElement.querySelector('[role=img]').getAttribute('aria-label')).toBe('42 percent toward goal');expect(fixture.nativeElement.textContent).toContain('42%');});});
