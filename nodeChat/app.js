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

io.on('connection', function(client){
  var chanel = "";
  client.on('join', function(name) {
    client.nickname = name;
  });
  client.on('chanel', function(data) {
    chanel = data;
    client.join(data);
      
    redisClient.lrange("messages", 0, -1, function(err, messages) {
    messages = messages.reverse();
    messages.forEach(function(message) {
        message = JSON.parse(message);
        client.emit("chat message", message.name + ": " + message.data);
        
    });
    });
      
  });
    
  client.on('chat message', function(message){
    var nickname = client.nickname;
    client.in(chanel).broadcast.emit("chat message", nickname +  ": " + message);
    client.emit("chat message", nickname +  ": " + message);
    storeMessage(nickname, message);
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});