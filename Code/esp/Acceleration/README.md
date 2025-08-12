Instructions for config.json:

    "wifi_ssid": "TP-Link_B0E0",

    "wifi_password": "89846834",

    "mqtt_server": "192.168.0.77",
    (In cmd write 'ipconfig', find line: IPv4 Address. . . . . . . . . . . : 192.168.0.77)

    "mqtt_port": 1883,

    "mqtt_topic": "acceleration", 
    (Choose between: acceleration / distance / temperature / current / infrared / water_flow)

    "sensor_id": "acc_1"
    (Set the sensor name. Should be always in this format: acc_x / dist_x / temp_x / current_x / infra_x / flow_x)

    "sensitivity": 0.000488,

    "buffer_size": 10,

    "sampling_frequency_Hz": 200
    (Set the sensor data collection rate, default is 200 Hz. Choose between: 1.6 / 12.5 / 25 / 50 / 100 / 200 / 400 / 800 / 1600),
    
    "send_interval_ms": 5000
    (Set the interval for sending data to mqtt in milliseconds),
    
    "range_g": 16
    (Set the sensor measurement range, default is ±16g. Choose between: 2 / 4 / 8 / 16) 