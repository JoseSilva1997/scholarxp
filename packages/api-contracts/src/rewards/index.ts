/* 
  EXP rewards. Whenever exp is awarded in the app, the API should return a structured 
  Awards object that breaks down the different components of the reward 
  (base question exp, first attempt bonus, streak bonus, account exp, etc).
  This allows the frontend to display a detailed breakdown of the rewards earned for each attempt, 
  and also makes it easier to add new reward components in the future without changing the API contract.
*/
export interface Awards {
  baseQuestionExp: number;
  firstAttemptBonus: number;
  streakBonus: number;
  accountExp: number;
}

export * from './daily-lesson-xp-track';
