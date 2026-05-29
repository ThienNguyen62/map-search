@echo off

echo Starting Flask...

start cmd /k "cd backend && python app.py"

timeout /t 3 > nul

<<<<<<< kien2
echo Opening Frontend...

start http://127.0.0.1:5000/html/login.html
=======
start http://127.0.0.1:5000
>>>>>>> main
