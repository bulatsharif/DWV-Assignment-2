from flask import Flask, request, jsonify # flask for server handling
from flask_cors import CORS # cors for allowing frontend to access the backend
import pandas as pd # pandas for dealing with csv 

# defining the application
app = Flask(__name__)
# adding to the cors so that frontend will have access to the backend
CORS(app)

# here I will save all data poinst received from sender
data = []

# endpoints needed for getting the packets from sender
# POST since it will have json file attached, and I need to take it
# and save it in the data list
@app.route("/receive", methods=["POST"])
def receive_point():
    data_rcvd = request.get_json()
    data.append(data_rcvd)
    return jsonify({"status": "success"}), 200

# this endpoint will be used on frontend to get the datapoints
# the frontend will save the index to request next data point
# the index will be passed in the url, so that it can get the data sequentially and in the correct time order
# it also introduces some check for index consistency
@app.route("/get_data/<index>", methods=["GET"])
def get_data(index: int):
    try:
        index = int(index)
        if index < 0 or index >= len(data):
            return jsonify({"error": "Index out of range"}), 400
        return jsonify(data[index]), 200
    except ValueError:
        return jsonify({"error": "Invalid index"}), 400
    



# Here start the application
# Disable logging since there will be spam in console otherwise
# and expose to the needed port and host.
if __name__ == "__main__":
    import logging
    # Disable the built-in werkzeug logger
    log = logging.getLogger('werkzeug')
    log.disabled = True
    app.logger.disabled = True

    app.run(port=5001, host="0.0.0.0", debug=False)
    