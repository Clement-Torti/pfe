import { Injectable } from '@angular/core';
import { Test } from '../models/test';
import { Step } from '../models/step';
import { DeviceType } from '../models/deviceType';

import { getEmptyTest } from '../mocks/test-mock';
import { EMPTY_STEP } from '../mocks/step-mock';

@Injectable({
  providedIn: 'root',
})
export class TestParserService {
  PYTHON_INDENT = '    ';

  private parseNextLine(code: string[], nbLine = 1): string[] {
    if (nbLine == -1 && code.length > 0) {
      if (code[0].length == 0) {
        return this.parseNextLine(code.slice(1), -1);
      }
      return code;
    }

    if (code.length > nbLine) {
      return code.slice(nbLine);
    } else {
      throw new Error('Bad format: Unexpected end of file');
    }
  }

  private testFormat(toBeTested: string, expected: string) {
    if (toBeTested !== expected) {
      throw new Error(
        "Bad format: \nExpected '" + expected + "'\nGot '" + toBeTested + "'"
      );
    }
  }

  parseFile(file: string): Test {
    const test = getEmptyTest();

    let code = file.split('\n');

    // Parse header
    code = this.parseHeader(code, test);

    // Parse class definition
    this.testFormat(
      code[0],
      'class HGMicro_Test(HGoMicro_Software_Verification_Base_Test):'
    );
    code = this.parseNextLine(code);

    this.testFormat(code[0], `${this.PYTHON_INDENT}def __init__(self):`);
    code = this.parseNextLine(code);

    this.testFormat(
      code[0],
      `${this.PYTHON_INDENT}${this.PYTHON_INDENT}super().__init__("${test.title}")`
    );

    code = this.parseNextLine(code, 2);

    code = this.parseSteps(code, test);

    console.log(code);

    return test;
  }

  private parseHeader(code: string[], test: Test): string[] {
    // Title
    const titleRegex = /# Title: (.*)/g;
    const titleMatch = titleRegex.exec(code[0]);
    if (titleMatch) {
      test.title = titleMatch[1];
    } else {
      throw new Error('Bad format: Title not found');
    }

    code = this.parseNextLine(code);

    // Author
    const authorRegex = /# Author: (.*) - using eTester/g;
    const authorMatch = authorRegex.exec(code[0]);
    if (authorMatch) {
      test.author = authorMatch[1];
    } else {
      throw new Error('Bad format: Author not found');
    }

    code = this.parseNextLine(code);

    // Description
    const descriptionRegex = /# Description: (.*)/g;
    const descriptionMatch = descriptionRegex.exec(code[0]);
    if (descriptionMatch) {
      test.description = descriptionMatch[1];
    } else {
      throw new Error('Bad format: Description not found');
    }

    code = this.parseNextLine(code);

    // Same for prerequisites
    const prerequisitesRegex = /# Prerequisites: (.*)/g;
    const prerequisitesMatch = prerequisitesRegex.exec(code[0]);
    if (prerequisitesMatch) {
      test.prerequisites = prerequisitesMatch[1];
    } else {
      throw new Error('Bad format: Prerequisites not found');
    }

    code = this.parseNextLine(code);

    // Same for device type
    const deviceTypeRegex = /# Device : (.*) \((.*)\)/g;
    const deviceTypeMatch = deviceTypeRegex.exec(code[0]);
    if (deviceTypeMatch) {
      code = this.parseNextLine(code);
      test.deviceName = deviceTypeMatch[1];
      if (
        Object.values(DeviceType).includes(deviceTypeMatch[2] as DeviceType)
      ) {
        test.deviceType = deviceTypeMatch[2] as DeviceType;
      } else {
        throw new Error("Bad format: Device type don't exist");
      }
    } else {
      test.deviceName = '';
      test.deviceType = null;
    }

    // return code without the first element
    return this.parseNextLine(code);
  }

  private parseSteps(code: string[], test: Test): string[] {
    const stepRegex = /def step(\d+)\(self\):/g;
    let stepMatch = stepRegex.exec(code[0]);

    while (stepMatch) {
      console.log('Step found: ', stepMatch[1], ' - ', code[0]);
      const step = EMPTY_STEP;

      code = this.parseNextLine(code); // Todo: Parse the code
      // regex getting the step title and description base d on this format: self.logScenario("Step 1: ", "Fake step", "Description of the step of the fake product")
      const stepTitleRegex =
        /self.logScenario\("Step \d+: ", "(.*)", "(.*)"\)/g;
      const stepInfoMatch = stepTitleRegex.exec(code[0]);
      if (stepInfoMatch) {
        step.title = stepInfoMatch[1];
        step.description = stepInfoMatch[2];
      } else {
        throw new Error(
          'Bad format: Step info not found,\nexpected: self.logScenario("Step X: ", "<title>>", "<description>")\nreceived: ' +
            code[0]
        );
      }

      code = this.parseNextLine(code);

      // Parse step code
      code = this.parseStepCode(code, step);

      test.steps.push(step);

      const stepRegex = /def step(\d+)\(self\):/g;
      stepMatch = stepRegex.exec(code[0]);
    }

    return code;
  }

  private parseStepCode(code: string[], step: Step): string[] {
    let stepCode = '';

    while (code[0].startsWith(this.PYTHON_INDENT.repeat(2)) || code[0] == '') {
      stepCode += code[0] + '\n';
      code = this.parseNextLine(code);
    }

    step.code = stepCode;

    return code;
  }

  private generateHeader(test: Test): string {
    const title = `# Title: ${test.title}\n`;
    const author = `# Author: ${test.author} - using eTester\n`;
    const description = `# Description: ${test.description}\n`;
    const prerequisites = `# Prerequisites: ${test.prerequisites}\n`;
    let deviceType = '';

    if (test.deviceType) {
      deviceType = `# Device : ${test.deviceName} (${test.deviceType})\n`;
    }

    return title + author + description + prerequisites + deviceType + '\n';
  }

  private generateSteps(test: Test): string {
    let steps = '';
    for (let i = 0; i < test.steps.length; i++) {
      const step = test.steps[i];

      steps += `${this.PYTHON_INDENT}def step${i + 1}(self):
${this.PYTHON_INDENT}${this.PYTHON_INDENT}self.logScenario("Step ${
        i + 1
      }: ", "${step.title}", "${step.description}")

${this.PYTHON_INDENT}${this.PYTHON_INDENT}${step.code}


`;
    }

    return steps;
  }

  private generateMain(test: Test): string {
    let main = `${this.PYTHON_INDENT}def test(self):
${this.PYTHON_INDENT}${this.PYTHON_INDENT}# ----------- 
${this.PYTHON_INDENT}${this.PYTHON_INDENT}# Init part
${this.PYTHON_INDENT}${this.PYTHON_INDENT}# 
${this.PYTHON_INDENT}${this.PYTHON_INDENT}self.logScenario("Initialization")
    
`;

    for (let i = 0; i < test.steps.length; i++) {
      const step = test.steps[i];

      main += `
${this.PYTHON_INDENT}${this.PYTHON_INDENT}# ${step.title}
${this.PYTHON_INDENT}${this.PYTHON_INDENT}self.step${i + 1}();
`;
    }

    main += `

${this.PYTHON_INDENT}${this.PYTHON_INDENT}# -----------
${this.PYTHON_INDENT}${this.PYTHON_INDENT}# Factory reset
${this.PYTHON_INDENT}${this.PYTHON_INDENT}# 
${this.PYTHON_INDENT}${this.PYTHON_INDENT}self.logScenario("Factory reset")`;

    return main;
  }

  generateCode(test: Test): string {
    const header = this.generateHeader(test);

    const className = `class HGMicro_Test(HGoMicro_Software_Verification_Base_Test):
${this.PYTHON_INDENT}def __init__(self):
${this.PYTHON_INDENT}${this.PYTHON_INDENT}super().__init__("${test.title}")\n\n`;

    const steps = this.generateSteps(test);

    const main = this.generateMain(test);

    return header + className + steps + main;
  }
}