const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const fs = require('fs');
const mkdirp = require('mkdirp');
const async = require('async');
const http = require('http');
const download = require('download-file');
const uniqid = require('uniqid');
const moment = require('moment');
const isWindows = require('check-if-windows');
const cmd = require('node-cmd');
const mv = require('mv');

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

function getTimeText() {
    return moment().format('HH:mm:ss');
};

function log(logMessage) {
    console.log(getTimeText() + ' -> ' + logMessage);
};

function error(errorMessage) {
    console.error(getTimeText() + ' -> ' + errorMessage);
};

var desktopFileTemplate;
fs.readFile('desktop.template', 'utf-8', (err, data) => {
    if (err) return error(err);
    desktopFileTemplate = data;
});

function generateDesktopFile(name, directory, iconFileName) {
    var nameRegex = /\{{2}name\}{2}/g;
    var directoryRegex = /\{{2}directory\}{2}/g;
    var iconFileNameRegex = /\{{2}icon-file-name\}{2}/g;

    var generatedDesktopFile = desktopFileTemplate
        .replace(nameRegex, name)
        .replace(directoryRegex, directory)
        .replace(iconFileNameRegex, iconFileName);

    var desktopFileName = name + '.desktop';
    var desktopFilePath = directory + '/' + desktopFileName;

    fs.writeFile(desktopFilePath, generatedDesktopFile, (err) => {
        if (err) return error(err);
    });

    var convertFromJpgToPngCommand = `convert ${directory}/01.png -resize 512x512\\! /home/gotoss08/.icons/${iconFileName}`;
    console.log('command to convert from jpg to png and resize: ' + convertFromJpgToPngCommand);

    if (!isWindows) {
        cmd.run(convertFromJpgToPngCommand);
        mv(desktopFilePath, directory + '/../../' + desktopFileName);
    }
};

function getInitialDirectory() {
    var windowsDirectory = './images/files';
    var linuxDirectory = '/home/gotoss08/Рабочий стол/Дома/Файлы';

    if (isWindows) return windowsDirectory;
    else return linuxDirectory;
};

app.post('/', (req, res) => {
    log('received data: ' + JSON.stringify(req.body, null, 2));

    var url = req.body.url;
    var title = req.body.title;
    var description = req.body.description;
    var fileText = title + '\r\n\r\n' + url + '\r\n\r\n' + description;

    var directory = getInitialDirectory() + '/' + title + '-' + moment().format('YYYYMMDDHHmmss') + '-' + uniqid();

    mkdirp(directory, (err) => {
        if (err) {
            error(err);
            return;
        }

        log('Storing data at: ' + directory);

        var i = 1;
        async.each(req.body['imgs[]'], async (url, next) => {
            if (i == 1) generateDesktopFile(title, directory, title + '.png');
            var filename = (i < 10 ? '0' : '') + (i++) + '.jpg';
            download(url, {directory: directory, filename: filename}, (err) => {
                if (err) error(err);
                log("'" + url + "' image downloaded");
            });
        }, (err) => {
            if (err) error(err);
        });

        fs.writeFile(directory + '/описание.txt', fileText, (err) => {
            if (err) {
                error(err);
                return res.sendStatus(400);
            }

            return res.status(200).send();
        });
    });
});

app.listen(3535, () => console.log('download home info server is running on port 3535'));
