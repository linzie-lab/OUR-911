from flask import jsonify, request


def json_object():
    if not request.is_json:
        return None, (jsonify(error="Content-Type must be application/json."), 400)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify(error="Request body must be a JSON object."), 400)
    return data, None


def required_text(data, field, label, maximum):
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        return None, f"{label} is required."
    value = value.strip()
    if len(value) > maximum:
        return None, f"{label} must be {maximum} characters or fewer."
    return value, None


def error_response(message, status):
    return jsonify(error=message), status
