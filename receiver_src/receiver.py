from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd

app = Flask(__name__)
CORS(app)
data = []

@app.route("/receive", methods=["POST"])
def receive_point():
    data_rcvd = request.get_json()
    data.append(data_rcvd)
    return jsonify({"status": "success"}), 200


@app.route("/get_data/<index>", methods=["GET"])
def get_data(index: int):
    try:
        index = int(index)
        if index < 0 or index >= len(data):
            return jsonify({"error": "Index out of range"}), 400
        return jsonify(data[index]), 200
    except ValueError:
        return jsonify({"error": "Invalid index"}), 400
    


if __name__ == "__main__":
    import logging
    # Disable the built-in werkzeug logger
    log = logging.getLogger('werkzeug')
    log.disabled = True
    app.logger.disabled = True

    app.run(port=5001, host="0.0.0.0", debug=False)
    