<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('payroll:backup')->dailyAt('02:00')->timezone('Africa/Casablanca')->withoutOverlapping();
