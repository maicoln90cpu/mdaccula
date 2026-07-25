import { Label } from '@/components/ui/label';
import { GENRES } from './constants';

interface GenresChecklistProps {
  selectedGenres: string[];
  setSelectedGenres: (v: string[]) => void;
}

export const GenresChecklist = ({ selectedGenres, setSelectedGenres }: GenresChecklistProps) => (
  <div className="space-y-2">
    <Label>Vertentes de Som * (selecione uma ou mais)</Label>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-lg">
      {GENRES.map((genre) => (
        <div key={genre} className="flex items-center space-x-2">
          <input
            type="checkbox"
            id={`genre-${genre}`}
            checked={selectedGenres.includes(genre)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedGenres([...selectedGenres, genre]);
              } else {
                setSelectedGenres(selectedGenres.filter((g) => g !== genre));
              }
            }}
            className="w-4 h-4 rounded border-input"
          />
          <label htmlFor={`genre-${genre}`} className="text-sm cursor-pointer">
            {genre}
          </label>
        </div>
      ))}
    </div>
    {selectedGenres.length === 0 && (
      <span className="text-sm text-destructive">Selecione pelo menos uma vertente</span>
    )}
  </div>
);
