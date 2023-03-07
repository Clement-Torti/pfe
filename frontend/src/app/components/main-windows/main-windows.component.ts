import { Component } from '@angular/core';

@Component({
  selector: 'app-main-windows',
  templateUrl: './main-windows.component.html',
  styleUrls: ['./main-windows.component.css'],
})
export class MainWindowsComponent {
  files?: FileList;
  folderOpen = false;
  currentView = 'home';

  onOpenFolder(files: any) {
    this.files = files;
    this.folderOpen = true;

    // const fileReader = new FileReader();
    // fileReader.onload = (_) => {
    //   console.log(fileReader.result);
    // };
    // fileReader.readAsText(this.files![0]);
  }

  onEditClicked() {
    this.currentView = 'edit';
  }

  onRunClicked() {
    this.currentView = 'run';
  }
}
