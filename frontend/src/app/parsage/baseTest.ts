/* eslint-disable */

export const BASE_TEST = `# -*- coding: cp1252 -*-
import sys
import PyQt5
from PyQt5 import QtCore
from PyQt5.QtCore import *
from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from fenetretest import Ui_GroupBox
import serial
import os
from ScriptParam import *
from testsUtils import *
import queue
import threading
import base64
from datetime import date
import time
import urllib
import ftplib as ftp
import filecmp
import difflib
import socket
# import SocketServer
import select
import requests
import json
import re
from datetime import datetime
import paramiko



class ScriptHGMicro_BaseTestParam (ScriptParamGeneral):
    def __init__(self, testName):
        ScriptParamGeneral.__init__(self)
        #Param perso script
        self._logPath="C:\\\\Temp\\\\" + testName + str(date.today())+ '_' + str(time.localtime()[3]) + '-' + str(time.localtime()[4]) + ".txt"


class testHGMicro_BaseTest(QGroupBox): 
    isLogin = False
    token = ""
    ccaBaseUrl = ""
    periphs = {} 
    # { deviceSerialNumber: {
    #   sensorType: sensorType,
    #   deviceId: deviceId,
    #   kittingId: kittingId,
    #       } 
    # }

    
    def __init__(self, testName, parent=None):
        super (testHGMicro_BaseTest, self).__init__(parent)

        #Creation du set de parametres � utiliser -> objet param
        self.param=ScriptHGMicro_BaseTestParam(testName)
        
        #Creation du pilote Phidgets
        self.phiphi=DriverPhidget()
        
        
        #open logfile if defined
        if self.param._logPath:
            self.logfile= open(self.param._logPath,'w')
        else:
            self.logfile = False
        #Creation de la queue avec le GUI
        self.queue=queue.Queue()
        #Creation du semaphore pour bloquer les traitements
        self.mutex=QMutex()
        #Creation de la fenetre (GUI du test) -> objet ui
        self.ui = Ui_GroupBox(self.queue)
        self.ui.setupUi(self)
        self.ui.close_event.connect(self.stopthread)

        #Creation et init du Timer de queue
        self.timer=QTimer()
        self.timer.timeout.connect(self.periodicCall)
        # QObject.connect(self.timer, pyqtSignal("timeout()"), self.periodicCall)
        self.timer.start(200)
        #Setup and start the thread
        # self.running=True
        # self.thread1 = threading.Thread(target=self.runtest)
        # self.thread1.start()


    # Récupère le token nécessaire à l'envoie de requête sur le CCA de test
    def getToken(self):
        self.ccaBaseUrl = "https://" + self.param.testCcaIp

        url = self.ccaBaseUrl + "/users/login"
        data = ""
        

        # Ajout des credentials dans la requête
        data = {'email': self.param.testCcaEmail,
                'password': self.param.testCcaPassword}

        # Envoie de la requete de login
        response = requests.post(url, data)
    
        # Traitement de la réponse
        if response.status_code != 200:
            print("HTTP REQUEST FAILURE, cant' get token")


        # Récupération du token dans la réponse
        response_json = json.loads(response.text)
        token = response_json["token"]

        return token


    # Envoie de requête sur le CCA de test
    def httpRequestCcaTest(self, method, route, data = None):
        headers = ""
        # Obtention du token permettant le requête si besoin
        if not self.isLogin:
            self.token = self.getToken()
            if self.token == None:
                print("Login error, can't retrieve token in getToken()")
                return

        # Ajout des credentials dans la requête
        headers = {"Content-type": "application/json",
            "Authorization": "Bearer " + self.token,
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive"}
        
        # self.queue.put("data : " + str(data))

        # Envoie de la requete
        response = requests.request(method, self.ccaBaseUrl + route, data=data, headers=headers)

        # Traitement de la réponse
        if response.status_code == 400  :
            self.queue.put("HTTP REQUEST FAILURE (" + str(response.status_code) + ") : " + route + " : " + response.text)
        

        return response


    #Polling de la queue
    def periodicCall(self):
        self.ui.processIncoming(self.logfile)
        # if not self.running:
        #    root.quit()


    #Killing thread on window close
    def stopthread (self):
        self.running=False
        self.thread1._Thread__stop()
        self.at_exit(0)


    #fonction init
    def inittest(self):
        ###INIT PART
        #ouvrir phidget
        
        self.phiphi.Open()
        
        #Power OFF au d�part
        self.phiphi.PowerOff(0)
        #ouvrir Ports S�rie
        self.param.ser.open()
        #open logfile if defined
        if self.param._logPath:
            self.logfile= open(self.param._logPath,'w')
        else:
            self.logfile = False


    #fonction at_exit
    def at_exit(self, code):
        try:
            if self.client:
                stdin, stdout, stderr = self.client.exec_command("kill $(pidof python2.7)\\n\\r")
                self.client.close()
        except:
            pass
        self.param.ser.flush()
        self.queue.join()
        self.phiphi.Close()
        if self.logfile:
            self.logfile.close()
        self.param.ser.close()
        self.ui.close()
        qApp.quit()
        exit(code)


    #Fonctions affichage BDD
    DisplayMessageSignal = pyqtSignal(str)
    DisplayQuestionSignal = pyqtSignal(str)

    @pyqtSlot(str)
    def DisplayMessageDialog(self, message):
        # msg_box = QMessageBox()
        # msg_box.setIcon(QMessageBox.Information)
        # msg_box.setText(message)
        # msg_box.exec_()
        QMessageBox.warning(self.ui, "Message Opérateur", message)
        self.mutex.unlock()

    @pyqtSlot(str)
    def DisplayQuestionDialog(self, message):
        # msg_box = QMessageBox()
        # msg_box.setIcon(QMessageBox.Question)
        # msg_box.setText(message)
        # msg_box.setStandardButtons(QMessageBox.Yes | QMessageBox.No)
        # return msg_box.exec_()
        self.ReponseQuestion=QMessageBox.question(self.ui, "Message Opérateur", message, QMessageBox.Yes | QMessageBox.No)
        self.mutex.unlock()


    def updateResult(self, result, newVal):
        if result == 1:
            return result
        else:
            return newVal

    def getDeviceSerialNumberFromDeviceId(self, deviceId):
        for dSN, val in self.periphs.items():
            if val["deviceId"] == deviceId:
                return dSN
            
        return None
    
    def getDeviceSerialNumberFromKittingId(self, kittingId):
        for dSN, val in self.periphs.items():
            if val["kittingId"] == kittingId:
                return dSN
            
        return None


    
    #Fonction de detection et d'attente de démarrage de la carte
    @staticmethod
    def WaitBootLinux(serialPortConsole, queue, UN, PWD):
        queue.put("Wait Start Linux...")
        if WaitSerial("healthgomicro login", serialPortConsole, queue, 60)!=0:
                queue.put("ERROR: no linux login: KO")
                return False
        if ATcmd(UN, "Password", serialPortConsole, queue, 10)!=0:
                        queue.put("ERROR: setting linux username: KO")
                        return False
        if ATcmd(PWD, "root@healthgomicro:~#", serialPortConsole, queue, 10)!=0:
                queue.put("ERROR: setting linux password: KO")
                return False
        else:
            queue.put("Got Shell prompt")
            return True


    #Fonction d'envoi d'une requete POST sur le HGC Frontend
    def httpPostHgcFrontend(self, url, data):
        headers = {"Content-type": "application/x-www-form-urlencoded"}

        # Envoie de la requete avec authentification
        route = "http://" + self.param.testBenchIp + ":5051" + url
        print(route)
        response = requests.request("POST", route, data=data, headers=headers, auth=(self.param.hgcFrontendUsername, self.param.hgcFrontendPassword))

        # Traitement de la réponse
        if response.status_code == 400  :
            self.queue.put("HTTP REQUEST FAILURE")
            print(response.text)

        # self.queue.put(response.status_code)
        # self.queue.put(response.text)

        # print(response.status_code)
        
        return response.text
 

    #Fonction d'envoi d'une requete POST sur le OM2M Server
    def httpPostOm2mServer(self, url, data):
        headers = {"Content-type": "application/vnd.onem2m-res+xml;ty=4","X-M2M-Origin":"admin:edcoin33"}

        # Envoie de la requete avec authentification
        route = "http://" + self.param.testBenchIp + ":8090" + url
        print(route)
        response = requests.request("POST", route, data=data, headers=headers)

        # Traitement de la réponse
        if response.status_code == 400  :
            self.queue.put("HTTP REQUEST FAILURE")
            print(response.text)

        self.queue.put(response.status_code)
        self.queue.put(response.text)

        print(response.status_code)
            
        return response.text

    #Configuration du Medical Server
    def MedicalServerConfig(self):
        print("In medicalServerConfig\\n")

        # Cleaning before adding 
        periphs = self.periphs
        res = self.cleanup(self.param.hgoMiniSerialNumber)
        self.periphs = periphs

        if res:
            return 1


        # Adding hub
        res = self.addHub(self.param.hgoMiniSerialNumber, self.param.ccaUserId, self.param.ccaCustomerId)

        if res:
            return 1

        # Ajout des sensors 
        # Rajouter le device. Pas grave s'il existe déjà. Le DeviceModelId ne correspond pas car non disponible en base pour le moment
        for deviceSerialNumber, val in self.periphs.items():
            res = self.addPeriph(deviceSerialNumber, self.periphs[deviceSerialNumber]["sensorType"], self.param.hgoMiniSerialNumber)
            if res:
                return 1
            
        # Moved from step 1
        # data = {"hubId": self.param.hgoMiniSerialNumber, "customerId": "edevice", "logs":1, "cloudRetransmissionPeriod": 14400, "cloudConnectPeriod": 82800, "smsPhoneNumber": "", "smsPassword": "","interviewId": "", "pstTimeout": 28800,"rtcTimeout": 604800}
        # self.httpPostHgcFrontend("/postOm2mSettings", data ) # Default value
        self.restartHGo()

        return 0

    
    def enableCcaServer(self):
        self.queue.put("Enabling Cca...")
        self.client=SSHExecCmd(self.param.testCcaIp ,self.param.testCcaLogin, self.param.testCcaPassword, "pm2 start efa")
        time.sleep(10)
        self.queue.put("Serveur Cca started.")
        

    def shutdownCcaServer(self):
        self.queue.put("Desabling Cca...")
        self.client=SSHExecCmd(self.param.testCcaIp ,self.param.testCcaLogin, self.param.testCcaPassword, "pm2 stop efa")
        time.sleep(10)
        self.queue.put("Serveur Cca stopped.")


    #Restauration parametrage
    def RestoreParams(self):
        print("Mise en place des parametres par defaut")
        self.queue.put("Mise en place des parametres par defaut")
        self.phiphi.PowerOff(0)
        time.sleep(2)
        self.phiphi.PowerOn(0)
        self.WaitBootLinux(self.param.ser,self.queue, self.param.hgoMiniLogin, self.param.hgoMiniPassword)
        print("Wait boot linux terminée")
        r=SendSerial('cp /etc/edevice/hub_db.default /var/lib/edevice/hub_db.db', self.param.ser, self.queue,10)
        time.sleep(2)
        r3=SendSerial('sync', self.param.ser, self.queue,10)
        time.sleep(2)
        settings = {"hubId": self.param.hgoMiniSerialNumber,"customerId": self.param.customer,"logs":0,"cloudRetransmissionPeriod":14400,"cloudConnectPeriod":82800,"smsPhoneNumber":"","smsPassword":"","interviewId":"","pstTimeout":28800,"rtcTimeout":604800}
        self.httpPostHgcFrontend("/postOm2mSettings", settings )
        settings = {"hubId": self.param.hgoMiniSerialNumber,"customerId": self.param.customer}
        self.httpPostHgcFrontend("/postOm2mClearLogs", settings )
        print("postNetworkApplicationStartStop:\\n")
        settings = {"id":self.param.networkApplicationName,"status": "true"}
        self.httpPostHgcFrontend("/postNetworkApplicationStartStop", settings )
        print("postOm2mStartStop:\\n")
        settings = {"status": "true"}
        self.httpPostHgcFrontend("/postOm2mStartStop", settings )
        print("Enable Medical Server:\\n")
        data = {"EnableServer": True}
        # self.httpRequestMedicalServer("POST", "/enableServer", data )
        print("Medical Server reject readings:\\n")
        data = {"RejectReadings": False}
        # self.httpRequestMedicalServer("POST", "/rejectReadings", data )
        # self.httpRequestMedicalServer("DELETE", "/reading?hubId=" + self.param.hgoMiniSerialNumber)
        self.phiphi.PowerOff(0)
        time.sleep(2)
        print("Fin de la mise en place des parametres par defaut")


    def executeSteps(self):
        #########
        ###Step1
        #########
        print("No steps cause in base test\\n")


    def logScenario(self, stepNumber, actionName, actionDescription):
        self.queue.put("STEP_" + str(stepNumber) + ": " + actionName + ": " + actionDescription)
        print("STEP_" + str(stepNumber) + ": " + actionName + ": " + actionDescription)
        
    #######################################
    ## Message Commands
    #######################################

    def sendOrder(self, message):
        self.mutex.lock()
        self.DisplayMessageSignal.emit(message)
        self.mutex.lock() # pour bloquer en attendant de r�sultat BDD
        self.mutex.unlock() # on a eu le resultat, on a donc repris mutex ligne ci-dessus, et on le relache donc de nouveau pour r�utilisation


    def sendQuestion(self, message, stepNumber, spec, isYesOK):
        self.mutex.lock()
        self.DisplayQuestionSignal.emit(message)
        self.mutex.lock() # pour bloquer en attendant de r�sultat BDD
        self.mutex.unlock() # on a eu le resultat, on a donc repris mutex ligne ci-dessus, et on le relache donc de nouveau pour r�utilisation

        if (self.ReponseQuestion == QMessageBox.Yes and isYesOK 
            or self.ReponseQuestion == QMessageBox.No and not isYesOK):
            self.queue.put("STEP_" + str(stepNumber) + ": " + spec + ": OK")
            return 0
        else:
            self.queue.put("STEP_" + str(stepNumber) + ": " + spec + ": KO")
            return 1



    #######################################
    ## Lifecycle Commands
    #######################################

    def powerOffHgo(self):
        self.phiphi.PowerOff(0)
        time.sleep(2)
    
    def powerOnHgo(self):
        self.phiphi.PowerOn(0)

    def restartHGo(self, bootMessage=None, stepNumber=None, spec=None):
        result = 0
        self.powerOffHgo()
        self.powerOnHgo()

        self.WaitBootLinux(self.param.ser,self.queue, self.param.hgoMiniLogin, self.param.hgoMiniPassword)
        
        # variante: r6=SendSerialAns('tail -f messages|grep "Hub state: normal"','hub_normal: Hub state: normal"', self.param.ser, self.queue,1800)      
        newRes = 0
        if bootMessage:
            newRes = SendSerialAns('tail -f /var/log/messages|grep "' + bootMessage + '"', bootMessage, self.param.ser, self.queue, 600) 
            answer = "STEP_" + stepNumber + ": " + spec  
        else:
            newRes = SendSerialAns('tail -f /var/log/messages|grep "successfully initialized"','Hub successfully initialized', self.param.ser, self.queue, 600)      
        
        result = self.updateResult(result, newRes)
        if result != 0:
            self.queue.put(answer + ": KO" if spec else "Demarrage: KO")
            return result
        else:
            self.queue.put(answer + ": OK" if spec else "Demarrage: OK")

        r7=SendSerial('\\03', self.param.ser, self.queue, 10)
        time.sleep(2)

        return result
    

    def sleep(self, seconds):
        time.sleep(seconds)


    def disconnectAndReconnectBatteries(self, periphName):
        result = 0

        self.powerOffHgo()

        message = "Déconnecter la batterie du périphérique " + periphName + "."
        self.sendOrder(message)

        self.sleep(60)

        message = "Reconnecter la batterie du périphérique " + periphName + " et attendre le redémarrage du périphérique"
        self.sendOrder(message)

        self.sleep(5)
       
        newRes = self.restartHGo()     
        result = self.updateResult(result, newRes)

        return result
        




    #######################################
    ## Device Commands
    #######################################
    

    # Ajout Hub: Fait
    def addHub(self, hgoMiniSerialNumber, ccaUserId, customerId):
        hubsensorlink = self.httpRequestCcaTest("GET", "/hubs")
        response_json = json.loads(hubsensorlink.text)
        hubListMedicalServer = []
        for i in response_json:
            hubListMedicalServer.append(i["serialNumber"])
    
        # Ajout du hub s'il n'existe pas 
        if self.param.hgoMiniSerialNumber not in hubListMedicalServer:
            print("Add hub in Medical Server")

            newHub = '{"id": ' + str(hgoMiniSerialNumber) + ', \\
            "serialNumber": "' + str(hgoMiniSerialNumber) + '", \\
            "UserId": "' + str(ccaUserId) + '", \\
            "CustomerId":"' + str(customerId) + '", \\
            "latestHeartbeatDateTime": "2022-02-22T13:47:38.000Z", \\
            "dateStart": "2022-02-22T13:47:38.000Z", \\
            "dateEnd": null, \\
            "kit": true, \\
            "debug": false \\
            }'


    
            data = newHub 
            
            result = self.httpRequestCcaTest("POST", "/hubs/add", data)

            if result.status_code == 201:
                self.queue.put("Hub " + hgoMiniSerialNumber + " added")
                return 0
            else:
                self.queue.put("Error: Hub " + hgoMiniSerialNumber + " not added. " + result.text + "(" + str(result.status_code) + ")")
                return 1
        else:
            print("Hub already in Medical Server")
            


    # Ajout Device: Fait
    def addDevice(self, deviceSerialNumber, sensorType, unitName=None):
        # get the sensorTypeId based on the sensorType
        sensorTypeId = 0
        for sensor in self.param.sensorTypes:
            if sensor["sensorType"] == sensorType:
                sensorTypeId = sensor["id"]

        if not sensorTypeId:
            self.queue.put("Can't retrieve sensorTypeId for sensorType " + sensorType)
            return 1

        newDevice = ''

        if unitName == None:
            newDevice = '''{
                "macAddress": "''' + str(deviceSerialNumber) + '''",
                "SensorTypeId": ''' + str(sensorTypeId) + ''',
                "DeviceModelId": 1,
                "UserId": "''' + self.param.ccaUserId + '''",
                "dateStart": "2020-07-15T06:36:59.000Z",
                "dateEnd": null
            }'''
        else:
            newDevice = '''{
                "macAddress": "''' + str(deviceSerialNumber) + '''",
                "SensorTypeId": ''' + str(sensorTypeId) + ''',
                "DeviceModelId": 1,
                "UserId": "''' + self.param.ccaUserId + '''",
                "parameters":
                [
                    {
                        "name":"unit",
                        "value":"''' + str(unitName) + '''"
                    }
                ],
                "dateStart": "2020-07-15T06:36:59.000Z",
                "dateEnd": null
            }'''


        result = self.httpRequestCcaTest("POST", "/devices/add", newDevice)

        if result.status_code == 201:
            # Adding the device to the local db periphs
            device = json.loads(result.text)      

            self.periphs[deviceSerialNumber]["deviceId"] = device["id"]
            self.queue.put("Device " + deviceSerialNumber + " added")

            return 0
        else:
            self.queue.put("Error: Device " + deviceSerialNumber + " not added. " + result.text + "(" + str(result.status_code) + ")")
            return 1



    # Ajout kitting: Fait
    def addKitting(self, deviceSerialNumber, hubId):
        deviceId = self.periphs[deviceSerialNumber]["deviceId"]

        # ... pour le préciser dans l'association kittings
        data =  '{ \\
            "dateStart": "2022-02-23T09:08:05.000Z", \\
            "DeviceId": ' + str(deviceId) + ', \\
            "DeviceModelId": 1, \\
            "HubId":  ' + str(hubId) + '\\
        }'

        """ Return value
        [
            {
                "id": 1,
                "dateStart": "2023-02-14T13:11:03.000Z",
                "dateEnd": null,
                "createdAt": "2023-02-14T13:11:03.000Z",
                "updatedAt": "2023-02-14T13:11:03.000Z",
                "DeviceId": 5,
                "DeviceModelId": 4,
                "HubId": 12
            },
            false
        ]
        """
        result = self.httpRequestCcaTest("POST", "/kittings/add", data)
        

        if result.status_code == 201:
            # Addint the device to the local db periphs
            kitting = json.loads(result.text)      
            self.periphs[deviceSerialNumber]["kittingId"] = kitting[0]["id"]
            self.queue.put("Kitting " + deviceSerialNumber + " added")

            return 0
        else:
            self.queue.put("Error: Kitting " + deviceSerialNumber + " not added. " + result.text + "(" + str(result.status_code) + ")")
            return 1



    # Get measurements from patient: A faire
    def getMeasurements(self, patientId, deviceId):
        """         
        [
            {
                "id": 2765,
                "hash": "12345678",
                "deviceDesc": null,
                "dateTimeTaken": "2020-07-13T00:00:00.000Z",
                "units": "kg",
                "value": 100.8,
                "createdAt": "2023-04-11T10:04:23.000Z",
                "updatedAt": "2023-04-11T10:04:23.000Z",
                "DeviceId": 1,
                "SeverityId": 2,
                "MeasurementTypeId": 1,
                "UserId": "2cdea5d8-fa79-428b-90de-a792a03ad2ad",
                "JsonMeasurements": [],
                "PictureMeasurements": [],
                "Severity": {
                    "id": 2,
                    "severity": "green",
                    "color": "green",
                    "createdAt": "2023-02-14T13:11:02.000Z",
                    "updatedAt": "2023-02-14T13:11:02.000Z"
                },
                "Device": {
                    "id": 1,
                    "macAddress": "111111111111",
                    "dateStart": "2023-02-14T13:11:02.000Z",
                    "dateEnd": null,
                    "serialNumber": "",
                    "label": null,
                    "hasCommunicatedThisMonth": false,
                    "createdAt": "2023-02-14T13:11:02.000Z",
                    "updatedAt": "2023-02-14T13:11:02.000Z",
                    "DeviceModelId": 4,
                    "SensorTypeId": 1,
                    "UserId": null,
                    "CustomerId": null,
                    "HealthCareProviderId": null,
                    "SensorType": {
                        "name": "weight scale"
                    }
                },
                "MeasurementType": {
                    "id": 1,
                    "measurementType": "weight",
                    "icon": null,
                    "displayable": true,
                    "createdAt": "2023-02-14T13:11:02.000Z",
                    "updatedAt": "2023-02-14T13:11:02.000Z"
                }
            }
        ] 
        """
        result = self.httpRequestCcaTest("GET", "/measurements/user/" + str(patientId))

        if result.status_code == 200:
            measurements = json.loads(result.text)
            self.queue.put("Measurements of patient " + patientId + " retrieved")

            return [m for m in measurements if m["DeviceId"] == deviceId]
        else:
            self.queue.put("Error: Measurements of patient " + patientId + " not retrieved. " + result.text)
            return -1
         


    def compareMeasurements(self, spec, stepNumber, oldMeasurements, newMeasurements, shouldBeDifferent, numNewMeasurements = 1):
        if (len(newMeasurements) - len(oldMeasurements) >= numNewMeasurements) and shouldBeDifferent \\
            or oldMeasurements == newMeasurements and not shouldBeDifferent:
            self.queue.put("STEP_" + str(stepNumber) + ": " + spec + ": OK")
            return 0
        else :
            self.queue.put("STEP_" + str(stepNumber) + ": HGMicro send data: KO")
            return 1



    def compareOneMeasurement(self, spec, stepNumber, comparison, deviceId):
        try:
            measurements = self.getMeasurements(self, self.param.ccaUserId, deviceId)

            if eval(f"{len(measurements)} {comparison}"):
                self.queue.put("STEP_" + str(stepNumber) + ": " + spec + ": OK")
                return 0
            else:
                self.queue.put("STEP_" + str(stepNumber) + ": " + spec + ": KO")
                return 1
            
        except (SyntaxError, NameError, TypeError):
            self.queue.put("in baseTest 'compareOneMeasurement', '{measurements} {comparison}' is not a valid comparison")
            self.queue.put("STEP_" + str(stepNumber) + ": " + spec + ": KO")
            return 1



    def removeKitting(self, kittingId):
        self.queue.put("Removing kitting " + str(kittingId) + "...")
        result = self.httpRequestCcaTest("DELETE", "/kittings/delete/" + str(kittingId))

        if result.status_code == 201:
            self.queue.put("Kitting " + str(kittingId) + " deleted")

            # Remove kitting from the local db self.periphs
            deviceSN = self.getDeviceSerialNumberFromKittingId(kittingId)
            if deviceSN != None:
                self.periphs[deviceSN]["kittingId"] = None

            return 0
        else:
            self.queue.put("Error: Kitting " + str(kittingId) + " not deleted. " + result.text + "(" + str(result.status_code) + ")")
            return 1



    def removeKittingBySerialNumber(self, deviceSerialNumber):
        kittingId = self.periphs[deviceSerialNumber]["kittingId"]
        if kittingId:
            self.removeKitting(kittingId)



    # Delete Device
    def removeDevice(self, deviceId):
        # Remove from the CCA db
        result = self.httpRequestCcaTest("DELETE", "/devices/delete/" + str(deviceId))
        
        if result.status_code == 201:
            self.queue.put("Device " + str(deviceId) + " deleted")

            # Remove from the local db self.periphs
            deviceSN = self.getDeviceSerialNumberFromDeviceId(deviceId)
            if deviceSN != None:
                self.periphs[deviceSN] = None

            return 0
        else:
            self.queue.put("Error: Device " + str(deviceId) + " not deleted. " + result.text + "(" + str(result.status_code) + ")")
            return 1

        
    
    def removePeriph(self, deviceSerialNumber):
        kittingId = self.periphs[deviceSerialNumber]["kittingId"]
        deviceId = self.periphs[deviceSerialNumber]["deviceId"]

        if kittingId and deviceId:
            res1 = self.removeKitting(kittingId)
            res2 = self.removeDevice(deviceId)
            if not res1 and not res2:
                del self.periphs[deviceSerialNumber]
                return 0
        
        return 1
    


    def addPeriph(self, deviceSerialNumber, sensorType, hubId, unitName=None):
        self.periphs[deviceSerialNumber] = {
            "sensorType": sensorType,
            "deviceId": None,
            "kittingId": None,
        }

        res1 = self.addDevice(deviceSerialNumber, sensorType, unitName)

        if not res1:
            # Associer le device au Patient (kitting). Pas grave si l'association est déjà faite
            # Il faut recuperer l'id du device ...
            res2 = self.addKitting(deviceSerialNumber, hubId)
            if not res2:
                return 0

        return 1
    


    # Delete Hub
    def removeHub(self, hubId):
        result = self.httpRequestCcaTest("DELETE", "/hubs/delete/" + str(hubId))

        if result.status_code == 201 or result.status_code == 404:
            self.queue.put("Hub " + str(hubId) + " deleted or not found (" + str(result.status_code) + ")")
            return 0
        else:
            self.queue.put("Error: Hub " + str(hubId) + " not deleted. " + result.text + "(" + str(result.status_code) + ")")
            return 1



    # Clean up the kittings, devices and the hub itself
    def cleanup(self, hubId):
        # Retreive all info for deletion
        result = self.httpRequestCcaTest("GET", "/kittings/DevicesByKittedHubs/" + str(hubId))
        if result.status_code == 200:
            data = json.loads(result.text)
            res1 = 0
            res2 = 0

            for kitting in data:
                res1 = self.removeKitting(kitting["id"])
                res2 = self.removeDevice(kitting["Device"]["id"])
            
            res3 = self.removeHub(hubId)

            if not res3:
                self.queue.put("Cleanup of Hub " + str(hubId) + " done")
                return 0
            
        self.queue.put("Error: Cleanup of Hub " + str(hubId) + " not done. ")
        return 1

            
    # Change periph unit
    def changePeriphUnitAndTest(self, stepNumber, deviceSerialNumber, unit, measureMessage, peripheralSpecMessage, measureSpecMessage):
        result = 0

        # Take old measurements
        deviceId = self.periphs[deviceSerialNumber]["deviceId"]
        oldMeasurements = self.getMeasurements(self.param.ccaUserId, deviceId)

        # Remove periph
        sensorType = self.periphs[deviceSerialNumber]["sensorType"]
        newRes = self.removePeriph(deviceSerialNumber)
        result = self.updateResult(result, newRes)
        self.sendOrder("Appuyer sur le bouton TOP et attendre que la LED 'HealthGO Cloud Communication' devienne verte fixe.")


        # Add new periph back again
        self.addPeriph(deviceSerialNumber, sensorType, self.param.hgoMiniSerialNumber, unit)
        self.sendOrder("Appuyer sur le bouton TOP et attendre que la LED 'HealthGO Cloud Communication' devienne verte fixe.")


        # Take measure
        newRes = self.sendQuestion(measureMessage, stepNumber, peripheralSpecMessage, True)
        result = self.updateResult(result, newRes)


        # Compare measures
        message = "Attendre que la LED 'HealthGO Cloud Communication' devienne verte fixe"
        self.sendOrder(message)
        deviceId = self.periphs[deviceSerialNumber]["deviceId"]
        newMeasurements = self.getMeasurements(self.param.ccaUserId, deviceId)
        shouldBeDifferent = True

        newRes = self.compareMeasurements(measureSpecMessage, stepNumber, oldMeasurements, newMeasurements, shouldBeDifferent)
        result = self.updateResult(result, newRes)

        return result



    
    # Verify that the time of the measurements is okay
    def measurementTimeIsToday(self, stepNumber, deviceSerialNumber, shouldBeDifferent):
        result = 0

        deviceId = self.periphs[deviceSerialNumber]["deviceId"]
        sensorType = self.periphs[deviceSerialNumber]["sensorType"]
        newMeasurements = self.getMeasurements(self.param.ccaUserId, deviceId)
        date_format = "%Y-%m-%d"

        measurementTime = datetime.strptime(newMeasurements[0]['dateTimeTaken'][:10], date_format)
        current_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)



        print("measurementTime: " + str(measurementTime))
        print("current_date: " + str(current_date))

        if shouldBeDifferent:
            spec = "STEP_" + str(stepNumber) + ": Internal time of " + str(sensorType) + " '" + str(deviceSerialNumber) + "' is not updated"

            if measurementTime != current_date:
                self.queue.put(spec + ": OK")
            else :
                self.queue.put(spec + ": KO")
                result=1
        else:
            spec = "STEP_" + str(stepNumber) + ": Internal time of " + str(sensorType) + " '" + str(deviceSerialNumber) + "' is updated after the first connection with the HGMicro"

            if measurementTime ==  current_date:
                self.queue.put(spec + ": OK")
            else :
                self.queue.put(spec + ": KO")
                result=1

        
        return result
    

    def getAllHubDevices(self, hubId):
        devices = {}
        result = self.httpRequestCcaTest("GET", "/kittings/DevicesByKittedHubs/:hubId?=" + hubId)

        if result.status_code == 200:
            data = json.loads(result)
    
            for item in data:
                devices.update({
                    item['Device']['macAddress']: {
                        'kittingId': item['id'],
                        'deviceId': item['Device']['id'],
                        'sensorType': [el["sensorType"] for el in self.param.sensorTypes if el["name"] == item['Device']['SensorType']['name']][0] 
                    }
                })
                    
    
            return devices
            
        
        self.queue.put('getAllHubDevices: Can\\'t retrieve devices: ' + result.status_code + ": " + result.text)
        return devices




    #######################################
    ## Database Commands
    #######################################

    def resetDb(self):
        result = 0 
        print("Configure the HGMicro to use default parameter")
        newRes = SendSerial('cp /etc/edevice/hub_db.default /var/lib/edevice/hub_db.db', self.param.ser, self.queue, 10)
        result = self.updateResult(result, newRes)
        time.sleep(2)
        newRes = SendSerial('sync', self.param.ser, self.queue, 10)
        result = self.updateResult(result, newRes)
        time.sleep(2)

        return result
    
    
    # Example of commandsStr: "request1; response1 => request2;"
    # What will be run:
    # SendSerialAns(request1, response1, self.param.ser, self.queue, 30)
    # self.sleep(2)
    # SendSerial(request2, self.param.ser, self.queue, 30)
    # self.sleep(2)
    def sendSQLCommands(self, stepNumber, commandsStr, spec):
        result = 0

        # Enter sqlite3 cli
        newRes = SendSerial('sqlite3 /var/lib/edevice/hub_db.db', self.param.ser, self.queue,10)
        time.sleep(2)

        newRes = WaitSerial('sqlite>', self.param.ser, self.queue, 10)
        if newRes != 0:
            self.queue.put("SQLITE CONNECT FAILURE")
            return 1
        time.sleep(2)

        # Extract commands
        commands  = commandsStr.split('=>')


        # Run commands
        for commandStr in commands:
            command = commandStr.split(";")
            command = [el for el in command if el.strip() != '']

            if len(command) == 1:
                SendSerial(command[0] + ';', self.param.ser, self.queue, 10)        
            elif len(command) == 2:
                newRes = SendSerialAns(command[0] + ';', command[1], self.param.ser, self.queue, 30)
                if newRes != 0:
                    self.queue.put(command[0], " KO (expected: " + command[1] + ")")
                    result = 1
            time.sleep(2)

        
        if result == 0:
            self.queue.put("STEP " + stepNumber + ": " + spec + ": OK")
        else:
            self.queue.put("STEP " + stepNumber + ": " + spec + ": KO")

        # Close cli
        newRes = SendSerial('\\04', self.param.ser, self.queue, 10)
        time.sleep(2)
        newRes = WaitSerial('root@healthgomicro:~#', self.param.ser, self.queue, 10)
        if newRes != 0:
            self.queue.put("Config FAILURE : escape of sqlite KO")
            result = 1
        else:
            self.queue.put("Config OK")
        
        newRes = SendSerial('sync', self.param.ser, self.queue,10)        
        time.sleep(5)

        return result



    #######################################
    ## Serial Commands
    #######################################

    def sendSerialAndWaitAns(self, command, answer, spec, timeToWait):
        r = SendSerialAns(command, answer, self.param.ser, self.queue, timeToWait)      
        if r != 0:
            self.queue.put(spec + ": KO")
            r = 1
        else:
            self.queue.put(spec + ": OK")
        
        SendSerial('\\03', self.param.ser, self.queue, 10)
        time.sleep(2)
        
        return r
    
    # Example of commandsStr: "AT+CGDCONT=1,'IP', 'aaa.bbb.com' => ATE1 ; OK"
    # What will be run:
    # SendSerial("AT+CGDCONT=1,'IP', 'aaa.bbb.com'", self.param.ser, self.queue, 30)
    # self.sleep(5)
    # SendSerialAns("ATE1", "OK", self.param.ser, self.queue, 30)
    def configureMicrocom(self, stepNumber, commandsStr, spec):
        result = 0

        # Enter microcom cli
        SendSerial("microcom -s 115200 /dev/ttymxc3", self.param.ser, self.queue, 30)
        self.sleep(5)

        # Extract commands
        commands = commandsStr.split("=>")

        # Run commands
        for commandStr in commands:
            command = commandStr.split(";")
            if len(command) == 1:
                SendSerial(command[0], self.param.ser, self.queue, 10)
            elif len(command) == 2:
                newRes = SendSerialAns(command[0], command[1], self.param.ser, self.queue, 30)
                if newRes != 0:
                    self.queue.put(command[0], " KO (expected: " + command[1] + ")")
                    result = 1
            self.sleep(5)
            

        # Close cli
        SendSerial('\\x18', self.param.ser, self.queue, 10)
        self.sleep(5)
        WaitSerial('root@healthgomicro:~#', self.param.ser, self.queue, 10)

        if result == 0:
            self.queue.put("STEP " + stepNumber + ": " + spec + ": OK")
        else:
            self.queue.put("STEP " + stepNumber + ": " + spec + ": KO")

        return result
    

    #######################################
    ## OM2M Commands
    #######################################

    def applicationStartStop(self, isStart):
        data = {}
        if isStart:
            data = {"id":"eDevice","status":"true"}
        else:
            data = {"id":"eDevice","status":"false"}  

        self.httpPostHgcFrontend("/postNetworkApplicationStartStop", data)


    def getContainerData(self, containerName):
        data = {"hubId": self.param.hgoMiniSerialNumber, "customerId":"edevice", "container": containerName}
        container = self.httpPostHgcFrontend("/getOm2mContainer", data)
        return json.loads(container)



    #######################################
    ## SSH Commands
    #######################################

    def waitingForSSHConnection(self, stepNumber):
        i = 0
        while i >= 20:
            newRes = SendSerialAns('ifconfig', 'tun0', self.param.ser, self.queue, 10)
            if newRes == 0:
                self.queue.put("STEP " + stepNumber + ": HGMicro available for Remote Control: OK")
                return True
            else :
                self.queue.put("Remote Control still not ready")
            
            i += 1
            self.sleep(30) 
        

        self.queue.put("STEP " + stepNumber + ": HGMicro available for Remote Control: KO")

        return False


    def runSSHCommand(self, command, completionCode):
        result = 0
        resultSsh = SSHExecCmd(self.param.vpnServerIp, self.param.vpnServerLogin, self.param.vpnServerPassword,  command)
        exec(completionCode, {'resultSsh': resultSsh, 'result': result})

        return result



    #######################################
    ## Other Commands
    #######################################
    def ifStatement(self, condition, thenStatement, elseStatement):

        if eval(condition):
            exec(thenStatement)
            return 0
        else:
            exec(elseStatement)
            return 1



    #Scenario du test
    def runtest(self):
        #########
        ### Init part:
        #########
        result=0 #Resultat du test

        self.inittest()

        self.queue.put("-"*10 + "Debut du test: HGMicro-TC-48 Communication with Thompson scale TBS705" + "-"*10)

        #########
        ### Paramétrage usine:
        #########
        res = self.MedicalServerConfig()
        if res:
            self.queue.put("Error: MedicalServerConfig failed")
            return 1

        #########
        ### Exécution des steps, redéfinie par la classe fille
        #########
        result = self.executeSteps()
        print("result: " + str(result))

        ########
        ## Restauration des paramétres par défaut:
        ########
        self.RestoreParams()
        for periph in self.periphs.keys():
            self.removePeriph(periph)
        self.removeHub(self.param.hgoMiniSerialNumber)

        
      
if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    print(app.instance())
    #4 lignes suivantes pour la traduction des fenetres
    locale = QLocale.system().name()
    translator=QTranslator ()
    translator.load("qt_" + locale, QLibraryInfo.location(QLibraryInfo.TranslationsPath))
    app.installTranslator(translator)
    #Creation de l'objet appli -> objet myapp
    myapp = testHGMicro_BaseTest("fakeTestName", {})
    #connect signals
    app.connect(myapp, pyqtSignal("DisplayMessageDialog(PyQt_PyObject)"),myapp.DisplayMessageDialog)
    app.connect(myapp, pyqtSignal("DisplayQuestionDialog(PyQt_PyObject)"),myapp.DisplayQuestionDialog)
    #affichage de la fenetre (GUI)
    myapp.show()
    #exit
    sys.exit(app.exec_())

`;
