/*
Keep difficulty bounded in [0, 1] with initial 0.5.
Update difficulty from attempt events, not manually.
Use a conservative update rule first, then iterate.
A practical first formula:

Compute a per-attempt “hardness signal”:
Incorrect answer -> positive hardness
Correct but slow -> slight positive hardness
Correct and fast -> negative hardness
Apply smoothing:
newDifficulty = clamp(old + alpha * signal, 0, 1)
Small alpha (e.g. 0.02–0.08) to avoid noisy swings.
Important design choices to settle before code:

Time normalization: compare timeToAnswer against a robust baseline (question type/module median), not raw seconds.
Outlier control: cap extreme times and ignore obvious abandoned attempts.
Cold-start stability: don’t trust early data too much (lower alpha until N attempts).
Anti-gaming: only first scored attempt per student per session, or weight retries less.
Recency: optionally weight recent attempts a bit higher so content can “recalibrate.”
*/

import { Injectable } from '@nestjs/common';

@Injectable()
export class QuestionDifficultyService {}
