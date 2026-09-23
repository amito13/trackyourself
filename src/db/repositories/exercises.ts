import type { LocalDatabase } from '../sqlite/connection';
import type { Exercise } from './types';

export class ExerciseRepository {
  constructor(private local: LocalDatabase) {}

  /** Cache cloud UUIDs; do not generate different IDs for the same seeded exercise. */
  cache(exercises: Exercise[]) {
    return this.local.write(async db => {
      for (const exercise of exercises) {
        await db.runAsync(`INSERT INTO exercises
          (id, name, muscle_group, image_url, tracking_type, default_weight_type, deleted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, muscle_group = excluded.muscle_group, image_url = excluded.image_url,
          tracking_type = excluded.tracking_type, default_weight_type = excluded.default_weight_type,
          deleted_at = excluded.deleted_at`, exercise.id, exercise.name, exercise.muscle_group,
        exercise.image_url, exercise.tracking_type, exercise.default_weight_type, exercise.deleted_at);
      }
    });
  }

  list(search = '', muscleGroup: string | null = null) {
    return this.local.read(db => db.getAllAsync<Exercise>(`SELECT * FROM exercises
      WHERE deleted_at IS NULL AND (? IS NULL OR muscle_group = ?)
      AND instr(lower(name), lower(?)) > 0 ORDER BY muscle_group, name`, muscleGroup, muscleGroup, search));
  }
}
