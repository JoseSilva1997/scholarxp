/* 
    For module unit practice:
    - Every lesson give a baseline 1000 XP
    - Each question gives 1000/number_of_questions XP the first time it is answered correctly, 0 XP on retries
    - Students can earn up to 300 XP extra:
        - 150/number_of_questions XP for answering questions correctly on the first try
        - 150 XP for correct answer streaks:
            - 50 XP for the highest streak >= 30% number_of_questions
            - 100 XP for the highest streak >= 50% number_of_questions
            - 150 XP for the highest streak = 100% number_of_questions
            A streak must be 3 or more correct answer in a row to start earning the streak bonus.
            Streaks start at 0 and reset to 0 on a wrong answer.
            Retrying a question does not increment the streak.
    - Completing the unit awards 100 ACCOUNT XP
*/

/*
    For account XP:
    - TotalXP = 100 * (Level - 1)^1.5 -> 100k exp for level 100 (MAX)

    - Each Daily Quest gives: 50xp
    - Master Quest (comple 1-3 daily revision) gives: 250 xp
    - Module Unit (lesson) completion gives:
        - 100 XP on the first completion of the day
        - 25 XP on the second
        - 0 XP on subsequent ones.
        These deminishing returns are to accomodate for students with multiple modules/lots of lessons. 
        This way they cannon gain too much exp per day and at max can gain an extra 25XP daily compared to students with 1-2 modules/lower amounts of lessons.
        It is also an additional deterrent for mass practice.
*/
