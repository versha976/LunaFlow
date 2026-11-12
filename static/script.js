
// WELCOME MESSAGE
function showMessage() {
    alert("Welcome to LunaFlow! Your cycle, your care.");
}


// CYCLE DATA
let lastPeriodDate = null;
let cycleLength = 28;
let periodDuration = 5;


// CALENDAR MONTH
let currentCalendarDate = new Date();


// CYCLE CALCULATOR

async function predictCycle() {

    let lastPeriod = document.getElementById("lastPeriod").value;
    let cycleInput = Number(document.getElementById("cycleLength").value);
    let durationInput = Number(document.getElementById("periodDuration").value);
    let result = document.getElementById("result");

    if (lastPeriod === "") {
        result.innerText = "Please select your last period date.";
        return;
    }

    if (!Number.isInteger(cycleInput) ||
        cycleInput < 21 || cycleInput > 45) {
        result.innerText = "Enter a cycle length between 21 and 45 days.";
        return;
    }

    if (!Number.isInteger(durationInput) ||
        durationInput < 1 || durationInput > 10 ||
        durationInput >= cycleInput) {
        result.innerText = "Please enter a valid period duration.";
        return;
    }

    let startDate = new Date(lastPeriod + "T00:00:00");

    let today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate > today) {
        result.innerText = "Last period date cannot be in the future.";
        return;
    }

    // SAVE DATA FOR CALENDAR
    lastPeriodDate = startDate;
    cycleLength = cycleInput;
    periodDuration = durationInput;

    // CALCULATE NEXT PERIOD
    let nextPeriod = new Date(startDate);
    nextPeriod.setDate(nextPeriod.getDate() + cycleLength);

    let options = {
        day: "numeric",
        month: "long",
        year: "numeric"
    };

    let formattedDate = nextPeriod.toLocaleDateString("en-US", options);

    result.innerHTML = `
        <h3>Your Estimated Next Period</h3>
        <p>${formattedDate}</p>
        <small>This is an estimate, not a medical guarantee.</small>
    `;

    // UPDATE DASHBOARD
    document.getElementById("dashboardNextPeriod").innerText = formattedDate;
    document.getElementById("dashboardCycleLength").innerText =
        cycleLength + " Days";
    document.getElementById("dashboardDuration").innerText =
        periodDuration + " Days";

    document.getElementById("dashboardMessage").innerText =
        "Your average cycle length is " + cycleLength +
        " days and your period duration is " + periodDuration +
        " days. Your next period is estimated to start on " +
        formattedDate + ". Keep tracking your cycle to understand your patterns.";

    // UPDATE CALENDAR
    renderCalendar();

    // SAVE CYCLE DETAILS IN MYSQL
    try {
        let response = await fetch("/save-cycle", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                lastPeriod: lastPeriod,
                cycleLength: cycleLength,
                periodDuration: periodDuration
            })
        });

        let data = await response.json();

        if (response.ok) {
            result.innerHTML +=
                "<p>✓ " + data.message + "</p>";
        } else if (response.status === 401) {
            result.innerHTML +=
                '<p>Please <a href="/login">login</a> to save your cycle details.</p>';
        } else {
            result.innerHTML += "<p>" + data.message + "</p>";
        }

    } catch (error) {
        result.innerHTML +=
            "<p>Could not connect to the server. Please try again.</p>";
    }
}



// CHECK WHETHER A DATE IS IN A RANGE
function isInDateRange(date, startDate, duration) {

    let dateValue = Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    let startValue = Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
    );

    let difference = (dateValue - startValue) / 86400000;

    return difference >= 0 && difference < duration;
}


// DISPLAY CALENDAR
function renderCalendar() {

    let year = currentCalendarDate.getFullYear();

    let month = currentCalendarDate.getMonth();

    let monthYear = document.getElementById("monthYear");

    let calendarDays = document.getElementById("calendarDays");

    let monthName = currentCalendarDate.toLocaleDateString(
        "en-US",
        { month: "long", year: "numeric" }
    );

    monthYear.innerText = monthName;

    calendarDays.innerHTML = "";

    // FIRST DAY OF MONTH
    let firstDay = new Date(year, month, 1).getDay();

    // TOTAL DAYS IN MONTH
    let totalDays = new Date(year, month + 1, 0).getDate();

    // EMPTY SPACES BEFORE FIRST DATE
    for (let i = 0; i < firstDay; i++) {

        let emptyCell = document.createElement("div");

        emptyCell.classList.add("empty");

        calendarDays.appendChild(emptyCell);
    }

    // CREATE DATE CELLS
    for (let day = 1; day <= totalDays; day++) {

        let dateCell = document.createElement("div");

        dateCell.innerText = day;

        let currentDate = new Date(year, month, day);

        // PREVIOUSLY RECORDED PERIOD
        if (lastPeriodDate &&
            isInDateRange(currentDate, lastPeriodDate, periodDuration)) {

            dateCell.classList.add("period-day");
        }

        // ESTIMATED NEXT PERIOD
        if (lastPeriodDate) {

            let nextPeriod = new Date(lastPeriodDate);

            nextPeriod.setDate(
                nextPeriod.getDate() + cycleLength
            );

            if (isInDateRange(currentDate, nextPeriod, periodDuration)) {

                dateCell.classList.add("predicted-day");
            }
        }

        calendarDays.appendChild(dateCell);
    }
}


// CHANGE MONTH
function changeMonth(direction) {

    currentCalendarDate.setMonth(
        currentCalendarDate.getMonth() + direction
    );

    renderCalendar();
}

// HANDLE CYCLE FORM SUBMISSION AND LOAD CALENDAR

document.addEventListener("DOMContentLoaded", function () {

    renderCalendar();

    const cycleForm = document.getElementById("cycleForm");

    cycleForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        await predictCycle();

    });

});

// SYMPTOM AND MOOD TRACKER

document.addEventListener("DOMContentLoaded", function () {

    const symptomForm = document.getElementById("symptomForm");

    symptomForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        let date = document.getElementById("symptomDate").value;

        let selectedSymptoms = [];

        document.querySelectorAll(
            'input[name="symptoms"]:checked'
        ).forEach(function (checkbox) {
            selectedSymptoms.push(checkbox.value);
        });

        let mood = document.getElementById("mood").value;
        let severity = document.getElementById("severity").value;
        let notes = document.getElementById("notes").value;

        let symptomResult = document.getElementById("symptomResult");

        if (!date) {
            symptomResult.innerText = "Please select a date.";
            return;
        }

        let selectedDate = new Date(date + "T00:00:00");
        let today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate > today) {
            symptomResult.innerText = "Date cannot be in the future.";
            return;
        }

        if (selectedSymptoms.length === 0) {
            symptomResult.innerText = "Please select at least one symptom.";
            return;
        }

        if (!mood) {
            symptomResult.innerText = "Please select your mood.";
            return;
        }

        if (!severity) {
            symptomResult.innerText = "Please select symptom severity.";
            return;
        }

        if (selectedSymptoms.length === 0) {
            document.getElementById("symptomResult").innerText =
                "Please select at least one symptom.";
            return;
        }

        try {

            let response = await fetch("/save-symptom", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    date: date,
                    symptoms: selectedSymptoms.join(", "),
                    mood: mood,
                    severity: severity,
                    notes: notes
                })
            });

            let data = await response.json();

            if (response.status === 401) {
                document.getElementById("symptomResult").innerHTML =
                    'Please <a href="/login">login</a> to save your entries.';
                return;
            }

            if (!response.ok) {
                throw new Error(data.message || "Could not save entry.");
            }

            document.getElementById("symptomResult").innerHTML = `
                <h3>Entry Saved Successfully! 💗</h3>
                <p>Date: ${date}</p>
                <p>Symptoms: ${selectedSymptoms.join(", ")}</p>
                <p>Mood: ${mood}</p>
                <p>Severity: ${severity}</p>
            `;

            symptomForm.reset();

            // History will be connected to MySQL in the next step.

        } catch (error) {

            document.getElementById("symptomResult").innerText =
                error.message;

        }

    });

});

// DISPLAY SYMPTOM HISTORY FROM MYSQL

async function displaySymptomHistory() {

    let historyContainer = document.getElementById("historyContainer");

    try {

        let response = await fetch("/get-symptoms");

        if (response.status === 401) {
            historyContainer.innerHTML = `
                <p>Please login to view your symptom history. 💗</p>
            `;
            return;
        }

        let entries = await response.json();

        if (!response.ok) {
            throw new Error(entries.message || "Could not load history.");
        }

        if (entries.length === 0) {
            historyContainer.innerHTML = `
                <div class="no-history">
                    <p>Your saved entries will appear here. 💗</p>
                </div>
            `;
            return;
        }

        historyContainer.innerHTML = "";

        entries.forEach(function (entry) {

            let card = document.createElement("div");
            card.className = "history-card";

            let heading = document.createElement("h3");
            heading.textContent = "📅 " + entry.entry_date;

            let symptoms = document.createElement("p");
            symptoms.textContent = "Symptoms: " + entry.symptoms;

            let mood = document.createElement("p");
            mood.textContent = "Mood: " + entry.mood;

            let severity = document.createElement("p");
            severity.textContent = "Severity: " + entry.severity;

            let notes = document.createElement("p");
            notes.textContent = "Notes: " + (entry.notes || "No notes added");

            card.appendChild(heading);
            card.appendChild(symptoms);
            card.appendChild(mood);
            card.appendChild(severity);
            card.appendChild(notes);
            // Create Delete button
            let deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete Entry";
            deleteButton.className = "delete-btn";

            deleteButton.addEventListener("click", function () {
                deleteSymptomEntry(entry.entry_id);
            });

            card.appendChild(deleteButton);
            historyContainer.appendChild(card);

        });

    } catch (error) {

        historyContainer.innerHTML =
            "<p>Could not load symptom history. Please try again.</p>";

        console.error(error);
    }
}

// DELETE A SAVED ENTRY

async function deleteSymptomEntry(entryId) {

    let confirmDelete = confirm(
        "Are you sure you want to delete this entry?"
    );

    if (!confirmDelete) return;

    try {
        let response = await fetch(`/delete-symptom/${entryId}`, {
            method: "DELETE"
        });

        let data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not delete entry.");
        }

        alert("Entry deleted successfully! 💗");

        await displaySymptomHistory();

    } catch (error) {
        alert(error.message);
    }
}


// LOAD HISTORY WHEN PAGE OPENS

document.addEventListener("DOMContentLoaded", function () {

    displaySymptomHistory();

});

// LOAD SAVED CYCLE DETAILS WHEN THE PAGE OPENS

document.addEventListener("DOMContentLoaded", async function () {

    try {
        const response = await fetch("/get-cycle");

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (!data.last_period_date) {
            return;
        }

        // Fill the Cycle Tracker form
        document.getElementById("lastPeriod").value =
            data.last_period_date;

        document.getElementById("cycleLength").value =
            data.cycle_length;

        document.getElementById("periodDuration").value =
            data.period_duration;

        // Restore calendar and dashboard values
        lastPeriodDate = new Date(
            data.last_period_date + "T00:00:00"
        );

        cycleLength = data.cycle_length;
        periodDuration = data.period_duration;

        let nextPeriod = new Date(lastPeriodDate);
        nextPeriod.setDate(
            nextPeriod.getDate() + cycleLength
        );

        let formattedDate = nextPeriod.toLocaleDateString(
            "en-US",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

        document.getElementById("dashboardNextPeriod").innerText =
            formattedDate;

        document.getElementById("dashboardCycleLength").innerText =
            cycleLength + " Days";

        document.getElementById("dashboardDuration").innerText =
            periodDuration + " Days";

        document.getElementById("dashboardMessage").innerText =
            "Your average cycle length is " + cycleLength +
            " days and your period duration is " + periodDuration +
            " days. Your next period is estimated to start on " +
            formattedDate + ".";

        renderCalendar();

    } catch (error) {
        console.log("Could not load saved cycle details:", error);
    }

});
