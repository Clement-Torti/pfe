import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Test } from 'src/app/models/test';
import { TestParserService } from 'src/app/services/test-parser.service';

@Component({
  selector: 'app-code-view',
  templateUrl: './code-view.component.html',
  styleUrls: ['./code-view.component.css'],
})
export class CodeViewComponent implements OnInit {
  @Input() test: Test | null = null;
  @Output() closeClick = new EventEmitter();
  code = '';

  constructor(private testParserService: TestParserService) {}

  ngOnInit(): void {
    if (this.test) {
      this.code = this.testParserService.generateCode(this.test);
    }
  }

  onCopyToClipboardClick() {
    navigator.clipboard.writeText(this.code);
  }

  onCloseCodeClick() {
    this.closeClick.emit();
  }
}
