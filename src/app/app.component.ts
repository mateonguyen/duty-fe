import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'Lịch trực';
  private auth = inject(AuthService);

  ngOnInit(): void {
    // Non-blocking bootstrap: load user from BFF cookie
    this.auth.loadMe().catch(() => {
      // Ignore errors; guards will handle redirect when needed
    });
  }
}
