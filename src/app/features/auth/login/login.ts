import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected get email() {
    return this.form.controls.email;
  }

  protected get password() {
    return this.form.controls.password;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      // Marca los campos para que se muestren sus mensajes en lugar de dejar el
      // botón inerte sin explicación.
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.auth
      .login(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isSubmitting.set(false);
          if (response.status === 'success') {
            void this.router.navigateByUrl(this.returnUrl());
            return;
          }
          // El backend responde con el mismo texto para cuenta inexistente y
          // contraseña incorrecta, a propósito, para no permitir enumerar cuentas.
          this.errorMessage.set(response.message ?? 'No se pudo iniciar sesión.');
        },
        error: (err: { error?: { message?: string } }) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err.error?.message ?? 'No se pudo iniciar sesión.');
        },
      });
  }

  /** Devuelve a la persona a la pantalla que pidió antes de identificarse. */
  private returnUrl(): string {
    const url = new URLSearchParams(window.location.search).get('returnUrl');
    return url && url.startsWith('/') ? url : '/mis-citas';
  }
}
