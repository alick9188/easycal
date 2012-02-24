// Import the APIs we need.
var widgets = require("widget");
var tabs = require("tabs");
var contextMenu = require("context-menu");
var panels = require("panel");

var notifications = require("notifications");
var privateBrowsing = require('private-browsing');

var data = require("self").data;

var storage = require("storage");
var schedules = require("schedule");
var remind = require("remind");

var easycalIsOn = true;

function toggleActivation () {
    easycalIsOn = !easycalIsOn;
    return easycalIsOn;
}

console.log("To start the main function...");

exports.main = function(options, callbacks) {
    console.log(options.loadReason);

    // Create a new context menu item.
    var menuItem = contextMenu.Item({
        label: "Add Selection to EasyCal",
        // Show this item when a selection exists.
        context: contextMenu.SelectionContext(),
        contentScriptFile: data.url('contextmenu.js'),
        // When we receive a message, set the right sched_id
        onMessage: function (schedule) {
            console.debug('contextMenu receive msg...');
            console.log('schedule: ' + JSON.stringify(schedule));
            // Get uniqe key
            var sched_index = storage.getItem('sched_index');
            console.log('sched_index: "'+sched_index+'"');
            if ((sched_index === null) || (sched_index === undefined)) {
                console.debug('set initial sched_index');
                sched_index = 0;
            } else {
                sched_index = parseInt(sched_index);
            }
            schedule.id = sched_index;
            // NOTE
            // If the schedule is not stored at last,
            // then one hole is born.
            storage.setItem('sched_index', sched_index + 1);
            console.log('just stored sched_index: "' +
                    storage.getItem('sched_index') + '"');

            console.debug('contextMenu id set...');
            console.log('schedule: ' + JSON.stringify(schedule));
            // NOTE this is shallow copy.
            editcalPanel.schedule = schedule;
            editcalPanel.contentURL = data.url('editcal/editcal.html');
            editcalPanel.port.emit('reset_html');
            editcalPanel.show();
        }
    });

    var editcalPanel= panels.Panel({
        width: 450,
        height: 280,
        contentURL: data.url('editcal/editcal.html'),
        contentScriptWhen: 'ready',
        contentScriptFile: [data.url('jquery.js'),
                            data.url('editcal/editcal.js')],
        onShow: function() {
            this.port.emit('fillform', editcalPanel.schedule);
        }

    });

    editcalPanel.port.on('close', function(){
        storage.dumpAllItems();
        editcalPanel.hide();
    });
    editcalPanel.port.on('save', function(schedule){
        console.debug('editcalPanel save schedule...');
        console.log('schedule: ' + JSON.stringify(schedule));
        var storekey = "sched" + schedule.id;
        storage.setItem(storekey, JSON.stringify(schedule));
        editcalPanel.port.emit('save_response', 'OK');
    });

    var popupPanel = panels.Panel({
        width: 550,
        height: 280,
        contentURL: data.url('popup/popup.html'),
        contentScriptWhen: 'ready',
        contentScriptFile: [data.url('jquery.js'),
                            data.url('popup/l10n.js'),
                            data.url('popup/jsDatePick.full.1.3.js'),
                            data.url('popup/jquery.cluetip.min.js'),
                            data.url('popup/popup.js')],
        onShow: function() {
            console.debug('popupPanel on the show');
            this.port.emit('show_popup');
        }
    });
    popupPanel.port.on('getSchedulesByTime', function(date_obj){
        console.debug('getSchedulesByTime...');
        var sched_list = schedules.getSchedulesByTime(date_obj);
        sched_list.forEach(function(element, index, array){
            console.log('sched_list[' + index + ']:' + JSON.stringify(element));
        });
        popupPanel.port.emit('sendSchedulesByTime', sched_list);
    });
    popupPanel.port.on('getSchedulesList', function(){
        console.log('getSchedulesList...');
        var sched_list = schedules.getSchedulesList();
        popupPanel.port.emit('sendSchedulesList', sched_list);
    });
    popupPanel.port.on('removeSchedule', function(sched_id){
        storage.removeItem(sched_id);
        storage.dumpAllItems();
    });
    popupPanel.port.on('getScheduleById', function(sched_id){
        var schedule_str = storage.getItem(sched_id);
        popupPanel.port.emit('sendScheduleById', schedule_str);
    });
    popupPanel.port.on('saveSchedule', function(schedule){
        console.debug('popupPanel save schedule...');
        console.log('schedule: ' + JSON.stringify(schedule));
        var storekey = "sched" + schedule.id;
        storage.setItem(storekey, JSON.stringify(schedule));
        //popupPanel.port.emit('saveSchedule_response', 'OK');
    });
    popupPanel.port.on('getNewScheduleId', function(){
        var sched_index = storage.getItem('sched_index');
        if (sched_index === null || sched_index === undefined) {
            sched_index = 0;
        } else {
            sched_index = parseInt(sched_index);
        }
        popupPanel.port.emit('sendNewScheduleId', sched_index);
        storage.setItem('sched_index', ++sched_index);
    });
    popupPanel.port.on('open_help_page', function(){
        tabs.open(data.url('help/Help.html'));
    });
    var widget = widgets.Widget({
        id: "easycal-popup",
        label: "Click to manage the schedules.",
        contentURL: data.url("widget/easycal-small-on.png"),
        onClick: function() {
            console.log('Show the calendar and schedule list...');
        },
        contentScriptWhen: 'ready',
        contentScriptFile: data.url('widget/widget.js'),
        panel: popupPanel,
    });

    // Remind
    remind.remindStart();

    // Show help at first install.
    if (storage.getItem("InitiallyShowHelp") === undefined) {
        storage.setItem("InitiallyShowHelp", "Done");
        // Open tab "Help.html"
        tabs.open(data.url('help/Help.html'));
    }
};