from flask import Flask, render_template, request, jsonify
import math

app = Flask(__name__)


def annuity_payment(amount, annual_rate, months):
    if months <= 0:
        return 0
    if annual_rate == 0:
        return amount / months

    r = annual_rate / 12 / 100
    return amount * (r * (1 + r) ** months) / ((1 + r) ** months - 1)


def calculate_schedule(amount, rate, months, early_payments,
                       payment_type='extra', reduce_type='payment',
                       one_time_types=None):

    monthly_rate = rate / 12 / 100
    balance = amount
    total_interest = 0
    schedule = []

    current_payment = annuity_payment(amount, rate, months)

    # Флаг фиксации платежа
    fixed_payment = False

    month = 1

    while balance > 0.01 and month <= 1200:

        interest = balance * monthly_rate
        total_interest += interest

        extra_amount = early_payments.get(month, 0)

        # Тип для текущего месяца
        monthly_reduce_type = reduce_type

        if one_time_types and month in one_time_types:
            monthly_reduce_type = one_time_types[month]

        # Если был выбран TERM —
        # фиксируем платеж
        if monthly_reduce_type == 'term':
            fixed_payment = True

        # Если PAYMENT —
        # снова разрешаем уменьшение платежа
        if monthly_reduce_type == 'payment':
            fixed_payment = False

        # Фактический платеж
        if payment_type == 'full' and extra_amount > 0:
            actual_payment = extra_amount
        else:
            actual_payment = current_payment + extra_amount

        if actual_payment < interest:
            actual_payment = interest + 0.01

        principal = actual_payment - interest

        if principal < 0:
            principal = 0

        if principal > balance:
            principal = balance
            actual_payment = principal + interest

        balance -= principal

        schedule.append({
            'month': month,
            'payment': round(current_payment, 2),
            'extra': round(extra_amount, 2),
            'interest': round(interest, 2),
            'principal': round(principal, 2),
            'balance': round(balance, 2),
            'total': round(actual_payment, 2)
        })

        if balance <= 0.01:
            break

        remaining_months = max(1, months - month)

        # Если платеж НЕ зафиксирован —
        # уменьшаем платеж
        if not fixed_payment:
            current_payment = annuity_payment(
                balance,
                rate,
                remaining_months
            )

        # Если fixed_payment=True —
        # платеж сохраняется, уменьшается срок

        month += 1

    return schedule, total_interest


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/calc", methods=["POST"])
def calc():
    try:
        data = request.json

        amount = float(data['amount'])
        rate = float(data['rate'])
        months = int(data['months'])

        payment_type = data.get('paymentType', 'extra')
        reduce_type = data.get('reduceType', 'payment')

        early_payments = {}
        one_time_types = {}

        # Ежемесячные досрочные платежи
        if data.get('monthly_enabled'):
            monthly_amount = float(data.get('monthly_amount', 0))
            for m in range(1, months + 1):
                early_payments[m] = early_payments.get(m, 0) + monthly_amount

        # Разовые платежи
        for ot in data.get('one_time', []):
            m = int(ot['month'])
            amt = float(ot['amount'])
            ot_type = ot.get('type', 'payment')
            if 1 <= m <= months:
                early_payments[m] = early_payments.get(m, 0) + amt
                one_time_types[m] = ot_type

        schedule, total_interest = calculate_schedule(
            amount,
            rate,
            months,
            early_payments,
            payment_type,
            reduce_type,
            one_time_types
        )

        return jsonify({
            'schedule': schedule,
            'months': len(schedule),
            'interest': round(total_interest, 2),
            'total_paid': round(amount + total_interest, 2),
            'principal': amount
        })

    except Exception as e:
        print(f"Error in calc: {e}")
        return jsonify({'error': str(e)}), 400


@app.route("/compare", methods=["POST"])
def compare():
    try:
        data = request.json

        amount = float(data['amount'])
        rate = float(data['rate'])
        months = int(data['months'])
        extra = float(data['extra'])
        reduce_type = data.get('reduceType', 'payment')
        is_monthly = data.get('is_monthly', False)
        monthly_count = data.get('monthly_count', 0)

        # Без досрочек
        base_schedule, base_interest = calculate_schedule(
            amount, rate, months, {}, 'extra', 'payment'
        )

        # С досрочками
        if is_monthly and monthly_count > 0:
            # Для ежемесячных - создаем платежи на КАЖДЫЙ месяц исходного срока
            early_payments = {}
            # Ограничиваем количество платежей исходным сроком
            max_months = min(monthly_count, months)
            for m in range(1, max_months + 1):
                early_payments[m] = early_payments.get(m, 0) + extra
            new_schedule, new_interest = calculate_schedule(
                amount, rate, months, early_payments, 'extra', reduce_type
            )
        else:
            # Для разовых - один платеж в первый месяц
            new_schedule, new_interest = calculate_schedule(
                amount, rate, months, {1: extra}, 'extra', reduce_type
            )

        return jsonify({
            'original_interest': round(base_interest, 2),
            'new_interest': round(new_interest, 2),
            'original_months': len(base_schedule),
            'new_months': len(new_schedule),
            'payment_saved': round(base_schedule[0]['payment'] - new_schedule[0]['payment'], 2) if len(new_schedule) > 0 else 0
        })

    except Exception as e:
        print(f"Error in compare: {e}")
        return jsonify({'error': str(e)}), 400

@app.route("/compare_base", methods=["POST"])
def compare_base():
    try:
        data = request.json
        amount = float(data['amount'])
        rate = float(data['rate'])
        months = int(data['months'])

        base_schedule, base_interest = calculate_schedule(
            amount, rate, months, {}, 'extra', 'payment'
        )

        return jsonify({
            'original_interest': round(base_interest, 2),
            'original_months': len(base_schedule)
        })

    except Exception as e:
        print(f"Error in compare_base: {e}")
        return jsonify({'error': str(e)}), 400


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8005, debug=True)
