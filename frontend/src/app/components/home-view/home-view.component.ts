import { Component, OnInit } from '@angular/core';
import { TaskService } from 'src/app/services/task.service';
import { Folder } from 'src/app/models/folder';
import { FolderService } from 'src/app/services/folder.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home-view',
  templateUrl: './home-view.component.html',
  styleUrls: ['./home-view.component.css'],
})
export class HomeViewComponent implements OnInit {
  folders: Folder[] = [];

  constructor(
    private taskService: TaskService,
    private folderService: FolderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.taskService.getFolders().subscribe((folders) => {
      this.folders = folders as Folder[];
    });
  }

  selectDirectory(files: any) {
    this.folderService.importFolder(files);
  }

  onFolderSelected(folder: Folder) {
    this.folderService.setFolder(folder._id);
    this.router.navigate([`/edit`]);
  }

  openFolderSelection(): void {
    const inputElement: HTMLInputElement = document.createElement('input');
    inputElement.type = 'file';
    inputElement.multiple = false;
    inputElement.webkitdirectory = true;
    inputElement.addEventListener('change', (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files) return;

      const pyFiles = Array.from(files).filter((file) =>
        file.name.endsWith('.py')
      );

      this.selectDirectory(pyFiles);
    });
    inputElement.click();
  }
}
