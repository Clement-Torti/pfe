import { Component } from '@angular/core';

import { Step } from 'src/app/models/step';
import { StepType } from 'src/app/models/stepType';
import { StepService } from 'src/app/services/step.service';
import { TaskService } from 'src/app/services/task.service';

@Component({
  selector: 'app-step-nav-bar',
  templateUrl: './step-nav-bar.component.html',
  styleUrls: ['./step-nav-bar.component.css'],
})
export class StepNavBarComponent {
  steps: Step[] = [];
  selectedStep: Step | null = null;

  constructor(
    private stepService: StepService,
    private taskService: TaskService
  ) {
    this.stepService.steps$.subscribe((steps) => {
      this.steps = steps;
      if (this.steps.length > 0) {
        this.stepService.setSelectedStep(this.steps[0]._id);
      }
    });

    this.stepService.selectedStep$.subscribe((step) => {
      this.selectedStep = step;
    });

    this.stepService.getSteps();
  }

  onStepClick(step: Step) {
    this.stepService.setSelectedStep(step._id);
  }

  onAddStepClick() {
    this.taskService
      .postStep(new Step('', 'new step', '', '', StepType.OTHER, [], 0, 0))
      .subscribe((_) => {
        this.stepService.getSteps();
      });
  }
}
