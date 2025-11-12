import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssignmentRead, SimpleUser } from '../../schedule';

@Component({
  standalone: true,
  selector: 'app-inspector-panel',
  imports: [CommonModule],
  templateUrl: './inspector-panel.component.html',
})
export class InspectorPanelComponent {
  @Input() selectedUser: SimpleUser | null = null;
  @Input() selectedShiftId: number | null = null;
  @Input() assignments: AssignmentRead[] = [];
}
