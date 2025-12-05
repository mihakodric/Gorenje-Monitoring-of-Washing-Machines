Instructions for config.json:

    "wifi_ssid": "TP-Link_B0E0",

    "wifi_password": "89846834",

    "mqtt_server": "192.168.0.77",
    (In cmd write 'ipconfig', find line: IPv4 Address. . . . . . . . . . . : xxx.xxx.x.xx)

    "mqtt_port": 1883
    (program files/mosquitto/mosquitto.conf open with notebook - run as administrator, add listener 1883, add another line: allow_anonymous true),

    "mqtt_topic": "water_flow", 
    (Choose between: acceleration / distance / temperature / current / infrared / water_flow)

    "sensor_id": "flow_1"
    (Set the sensor name. Should be always in this format: acc_x / dist_x / temp_x / current_x / infra_x / flow_x)

    "buffer_size": 10,

    "sampling_interval_ms" : 500