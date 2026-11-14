
from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

import mysql.connector

app.secret_key = os.getenv("SECRET_KEY")

# Connect Flask to MySQL

def get_db_connection():
    return mysql.connector.connect(
        host="127.0.0.1",
        port=3306,
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )


@app.route("/")
def home():
    return render_template("index.html")

@app.route("/db-test")
def db_test():

    try:
        connection = get_db_connection()

        cursor = connection.cursor()

        cursor.execute("SELECT DATABASE()")

        database_name = cursor.fetchone()

        cursor.close()
        connection.close()

        return f"MySQL Connected Successfully! Database: {database_name[0]}"

    except mysql.connector.Error as error:

        return f"MySQL Connection Failed: {error}"



@app.route("/register", methods=["GET", "POST"])
def register():

    if request.method == "POST":

        full_name = request.form["full_name"]
        email = request.form["email"]
        password = request.form["password"]

        hashed_password = generate_password_hash(password)

        connection = get_db_connection()
        cursor = connection.cursor()

        try:
            query = """
                INSERT INTO users (full_name, email, password)
                VALUES (%s, %s, %s)
            """

            values = (full_name, email, hashed_password)

            cursor.execute(query, values)
            connection.commit()

            return "Account created successfully! Registration complete."

        except mysql.connector.IntegrityError:
            return "This email is already registered. Please use another email."

        finally:
            cursor.close()
            connection.close()

    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":

        email = request.form["email"]
        password = request.form["password"]

        connection = get_db_connection()
        cursor = connection.cursor()

        try:
            cursor.execute(
                "SELECT user_id, full_name, password FROM users WHERE email = %s",
                (email,)
            )

            user = cursor.fetchone()

            if user and check_password_hash(user[2], password):
                session["user_id"] = user[0]
                session["full_name"] = user[1]

                return redirect(url_for("home"))

            return "Invalid email or password. Please try again."

        finally:
            cursor.close()
            connection.close()

    return render_template("login.html")

@app.route("/logout")
def logout():

    session.clear()

    return redirect(url_for("home"))

@app.route("/save-cycle", methods=["POST"])
def save_cycle():

    if "user_id" not in session:
        return jsonify({"message": "Please login first."}), 401

    data = request.get_json()

    last_period = data.get("lastPeriod")
    cycle_length = data.get("cycleLength")
    period_duration = data.get("periodDuration")

    if not last_period:
        return jsonify({"message": "Last period date is required."}), 400

    try:
        cycle_length = int(cycle_length)
        period_duration = int(period_duration)

        if not 21 <= cycle_length <= 45:
            return jsonify({"message": "Invalid cycle length."}), 400

        if not 1 <= period_duration <= 10 or period_duration >= cycle_length:
            return jsonify({"message": "Invalid period duration."}), 400

        from datetime import date
        period_date = date.fromisoformat(last_period)

        if period_date > date.today():
            return jsonify({"message": "Date cannot be in the future."}), 400

    except (ValueError, TypeError):
        return jsonify({"message": "Invalid cycle details."}), 400

    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        query = """
            INSERT INTO cycle_details
            (user_id, last_period_date, cycle_length, period_duration)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            last_period_date = VALUES(last_period_date),
            cycle_length = VALUES(cycle_length),
            period_duration = VALUES(period_duration)
        """

        values = (
            session["user_id"],
            period_date,
            cycle_length,
            period_duration
        )

        cursor.execute(query, values)
        connection.commit()

        return jsonify({"message": "Cycle details saved successfully!"})

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({"message": "Unable to save cycle details."}), 500

    finally:
        cursor.close()
        connection.close()


@app.route("/get-cycle", methods=["GET"])
def get_cycle():

    if "user_id" not in session:
        return jsonify({"message": "Please login first."}), 401

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT last_period_date, cycle_length, period_duration
            FROM cycle_details
            WHERE user_id = %s
            """,
            (session["user_id"],)
        )

        cycle = cursor.fetchone()

        if cycle:
            cycle["last_period_date"] = cycle["last_period_date"].isoformat()

        return jsonify(cycle or {})

    except mysql.connector.Error:

        app.logger.exception("Database error while loading cycle")

        return jsonify({
            "message": "Unable to load cycle details. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()



@app.route("/save-symptom", methods=["POST"])
def save_symptom():

    if "user_id" not in session:
        return jsonify({"message": "Please login first."}), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"message": "Invalid request data."}), 400

    entry_date = data.get("date")
    symptoms = data.get("symptoms", "")
    mood = data.get("mood", "")
    severity = data.get("severity", "")
    notes = data.get("notes", "")

    # SERVER-SIDE VALIDATION

    from datetime import date

    try:
        if not entry_date:
            return jsonify({"message": "Date is required."}), 400

        entry_date = date.fromisoformat(entry_date)

        if entry_date > date.today():
            return jsonify({"message": "Date cannot be in the future."}), 400

    except (ValueError, TypeError):
        return jsonify({"message": "Please enter a valid date."}), 400

    if not isinstance(symptoms, str) or not symptoms.strip():
        return jsonify({"message": "Please select at least one symptom."}), 400

    if mood not in ["Happy", "Calm", "Irritated", "Sad",
                    "Anxious", "Low Energy"]:
        return jsonify({"message": "Please select a valid mood."}), 400

    if severity not in ["Mild", "Moderate", "Severe"]:
        return jsonify({"message": "Please select valid severity."}), 400

    if not isinstance(notes, str):
        return jsonify({"message": "Invalid notes."}), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO symptom_entries
            (user_id, entry_date, symptoms, mood, severity, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                symptoms = VALUES(symptoms),
                mood = VALUES(mood),
                severity = VALUES(severity),
                notes = VALUES(notes)
        """

        cursor.execute(query, (
            session["user_id"],
            entry_date,
            symptoms,
            mood,
            severity,
            notes
        ))

        connection.commit()

        return jsonify({
            "message": "Symptom entry saved successfully!"
        })

    except mysql.connector.Error:
        if connection:
            connection.rollback()

        app.logger.exception("Database error while saving symptom")

        return jsonify({
            "message": "Unable to save your entry. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


@app.route("/get-symptoms", methods=["GET"])
def get_symptoms():

    if "user_id" not in session:
        return jsonify({"message": "Please login first."}), 401

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT entry_id, entry_date, symptoms,
                   mood, severity, notes
            FROM symptom_entries
            WHERE user_id = %s
            ORDER BY entry_date DESC
        """

        cursor.execute(query, (session["user_id"],))
        entries = cursor.fetchall()

        for entry in entries:
            entry["entry_date"] = entry["entry_date"].isoformat()

        return jsonify(entries)

    except mysql.connector.Error:

        app.logger.exception("Database error while loading symptoms")

        return jsonify({
            "message": "Unable to load symptom history. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()



@app.route("/delete-symptom/<int:entry_id>", methods=["DELETE"])
def delete_symptom(entry_id):

    if "user_id" not in session:
        return jsonify({"message": "Please login first."}), 401

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            DELETE FROM symptom_entries
            WHERE entry_id = %s AND user_id = %s
        """

        cursor.execute(query, (entry_id, session["user_id"]))
        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({
                "message": "Entry not found."
            }), 404

        return jsonify({
            "message": "Entry deleted successfully!"
        })

    except mysql.connector.Error:

        if connection:
            connection.rollback()

        app.logger.exception("Database error while deleting symptom")

        return jsonify({
            "message": "Unable to delete entry. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


if __name__ == "__main__":
    app.run(debug=True)
