Instructions for config.json:
    "wifi_ssid": "TP-Link_B0E0",

    "wifi_password": "89846834",

    "mqtt_server": "192.168.0.77",
     (in cmd write 'ipconfig', find line: IPv4 Address. . . . . . . . . . . : 192.168.0.77)

    "mqtt_port": 1883,

    "mqtt_topic": "acceleration", 
    (choose between: acceleration / distance / temperature / current / infrared / water_flow)

    "sensor_id": "acc_1"
    (name of the sensor. Should be always in this format: acc_x / dist_x / temp_x / current_x / infra_x / flow_x)
