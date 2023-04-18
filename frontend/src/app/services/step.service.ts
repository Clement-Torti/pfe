import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { StepType } from '../models/stepType';
import { Step } from '../models/step';
import { BOOT_STEPS } from '../mocks/step-mock';
import { TaskService } from './task.service';

@Injectable({
  providedIn: 'root',
})
export class StepService {
  private _steps = new BehaviorSubject<Step[]>([]);
  public steps$ = this._steps.asObservable();

  private _selectedStep = new BehaviorSubject<Step | null>(null);
  public selectedStep$ = this._selectedStep.asObservable();

  constructor(private taskService: TaskService) {}

  getStepType(): StepType[] {
    return Object.values(StepType);
  }

  getSteps(): Step[] {
    return BOOT_STEPS;
  }

  getStepsByType(stepType: StepType): Step[] {
    return BOOT_STEPS.filter((step) => step.stepType === stepType);
  }

  setSelectedStep(stepId: string) {
    const step = this._steps.value.find((step) => step._id === stepId);
    if (step) {
      this._selectedStep.next(step);
    }
  }
}
