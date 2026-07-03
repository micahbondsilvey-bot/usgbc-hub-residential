import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Cross-field validator: the target control's value must equal this control's.
 * Pure and PBT-friendly: equalTo(s)(s) is valid; equalTo(s)(s2) invalid iff s !== s2.
 */
export function equalToControl(otherControlName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    if (!parent) return null;
    const other = parent.get(otherControlName);
    if (!other) return null;
    return control.value === other.value ? null : { notEqual: true };
  };
}
