import React from 'react';
import { Star } from 'lucide-react';

/** Read only rating display. */
export const Stars: React.FC<{
  rating?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ rating = 5, size = 'sm', className = '' }) => {
  const box = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  return (
    <span
      className={`flex gap-0.5 ${className}`}
      role="img"
      aria-label={`${rating} étoiles sur 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${box} ${i <= Math.round(rating) ? 'fill-ambre text-ambre' : 'text-pierre-line'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
};

/**
 * Interactive rating picker.
 *
 * Built on real radio inputs rather than clickable divs, so it is keyboard
 * operable and announced correctly without re implementing what a radio group
 * already does.
 */
export const StarInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  name?: string;
}> = ({ value, onChange, name = 'rating' }) => {
  const LABELS = ['Très déçu', 'Déçu', 'Correct', 'Satisfait', 'Excellent'];

  return (
    <div>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Votre note">
        {[1, 2, 3, 4, 5].map((i) => (
          <label
            key={i}
            className="cursor-pointer p-1 -m-1 rounded-lg focus-within:outline-2 focus-within:outline-terracotta"
          >
            <input
              type="radio"
              name={name}
              value={i}
              checked={value === i}
              onChange={() => onChange(i)}
              className="sr-only"
            />
            <Star
              className={`w-8 h-8 transition-colors ${
                i <= value ? 'fill-ambre text-ambre' : 'text-pierre-line hover:text-ambre/50'
              }`}
              aria-hidden="true"
            />
            <span className="sr-only">{i} sur 5, {LABELS[i - 1]}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-pierre-deep" aria-live="polite">
        {value ? LABELS[value - 1] : 'Choisissez une note'}
      </p>
    </div>
  );
};
