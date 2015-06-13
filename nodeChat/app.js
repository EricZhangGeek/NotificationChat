var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var redis = require("redis");
var redisClient = redis.createClient();
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

var storeMessage = function(name, data) {
    var message = JSON.stringify({name: name, data: data});
    
    redisClient.lpush("messages", message, function(err, reponse) {
    redisClient.ltrim("messages", 0, 9);
    });
    
}

var storeUsers = function(name) {
    var username = JSON.stringify({name: name});
    redisClient.lpush("users", username, function() {
        redisClient.ltrim("users", 0, 9);
    });
}

var storeChannel = function(name, callback) {
    var dup = false;
    redisClient.lrange("channel", 0, -1, function(err, channelNames) {
        for (var i = 0; i < channelNames.length; i++) {
            var nameJson = JSON.parse(channelNames[i]);
            if (nameJson.name == name) {
                dup = true;
                break;
            }
        }
        if (!dup) {
            var channelName = JSON.stringify({name: name});
            redisClient.lpush("channel", channelName);
            redisClient.lrange("channel", 0, -1, function (err, newChannels) {
                callback(null, newChannels);
            });
        } else {
            callback(null, channelNames);
        }

    });
}

io.on('connection', function(client){
  var chanel = "";
  client.on('join', function(name) {
    client.nickname = name;
  });

  client.on('channel', function(data) {
    chanel = data;
    client.join(data);
      
    redisClient.lrange("messages", 0, -1, function(err, messages) {
    messages = messages.reverse();
    messages.forEach(function(message) {
        message = JSON.parse(message);
        client.emit("chat message", message.name + ": " + message.data);
    });
    });

    storeChannel(data, function(err, channelNames) {
        if (!err) {
            channelNames = channelNames.reverse();
            channelNames.forEach(function(channel) {
                channel = JSON.parse(channel);
                client.emit("new channel", channel.name);
            });
        }
    });


  });

  client.on('new user', function(name) {
      client.broadcast.emit("new user", name);
      redisClient.lrange("users", 0, -1, function(err, onlineUsers) {
          onlineUsers = onlineUsers.reverse();
          onlineUsers.forEach(function(user) {
              user = JSON.parse(user);
              client.emit("new user", user.name);

          });
          client.emit("new user", name);
      });
      storeUsers(name);
  });
    
  client.on('chat message', function(message){
    var nickname = client.nickname;
    client.in(chanel).broadcast.emit("chat message", nickname +  ": " + message);
    client.emit("chat message", nickname +  ": " + message);
    storeMessage(nickname, message);
  });

  client.on('join group', function(groupname) {
      console.log("=====server===join group=======" + data);
      client.broadcast.emit('join group', data);
      client.join(groupname);
  });
  client.on('new group', function(data) {
      console.log("========server=======" + data);
      client.broadcast.emit('join group', data);
  });

});

http.listen(3000, function(){
  console.log('listening on *:3000');
});