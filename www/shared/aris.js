(function() {
  'use strict';
  var $, ARIS_URL, Aris, Colors, Comment, Game, Note, SIFTR_URL, Tag, User, k, ref, v;

  $ = require('jquery');

  ARIS_URL = 'http://arisgames.org/server/';

  SIFTR_URL = window.location.origin + '/';

  Game = (function() {
    function Game(json) {
      if (json != null) {
        this.game_id = parseInt(json.game_id);
        this.name = json.name;
        this.description = json.description;
        this.latitude = parseFloat(json.map_latitude);
        this.longitude = parseFloat(json.map_longitude);
        this.zoom = parseInt(json.map_zoom_level);
        this.siftr_url = json.siftr_url || null;
        this.is_siftr = parseInt(json.is_siftr) ? true : false;
        this.published = parseInt(json.published) ? true : false;
        this.moderated = parseInt(json.moderated) ? true : false;
        this.colors_id = parseInt(json.colors_id) || null;
        this.icon_media_id = parseInt(json.icon_media_id);
        this.created = new Date(json.created.replace(' ', 'T') + 'Z');
      } else {
        this.game_id = null;
        this.name = null;
        this.description = null;
        this.latitude = null;
        this.longitude = null;
        this.zoom = null;
        this.siftr_url = null;
        this.is_siftr = null;
        this.published = null;
        this.moderated = null;
        this.colors_id = null;
        this.icon_media_id = null;
        this.created = null;
      }
    }

    Game.prototype.createJSON = function() {
      return {
        game_id: this.game_id || void 0,
        name: this.name || '',
        description: this.description || '',
        map_latitude: this.latitude || 0,
        map_longitude: this.longitude || 0,
        map_zoom_level: this.zoom || 0,
        siftr_url: this.siftr_url,
        is_siftr: this.is_siftr,
        published: this.published,
        moderated: this.moderated,
        colors_id: this.colors_id,
        icon_media_id: this.icon_media_id
      };
    };

    return Game;

  })();

  Colors = (function() {
    function Colors(json) {
      this.colors_id = parseInt(json.colors_id);
      this.name = json.name;
      this.tag_1 = json.tag_1;
      this.tag_2 = json.tag_2;
      this.tag_3 = json.tag_3;
      this.tag_4 = json.tag_4;
      this.tag_5 = json.tag_5;
    }

    return Colors;

  })();

  User = (function() {
    function User(json) {
      this.user_id = parseInt(json.user_id);
      this.display_name = json.display_name || json.user_name;
    }

    return User;

  })();

  Tag = (function() {
    function Tag(json) {
      var ref, ref1;
      if (json != null) {
        this.icon_url = (ref = json.media) != null ? (ref1 = ref.data) != null ? ref1.url : void 0 : void 0;
        this.tag = json.tag;
        this.tag_id = parseInt(json.tag_id);
        this.game_id = parseInt(json.game_id);
      } else {
        this.icon_url = null;
        this.tag = null;
        this.tag_id = null;
        this.game_id = null;
      }
    }

    Tag.prototype.createJSON = function() {
      return {
        tag_id: this.tag_id || void 0,
        game_id: this.game_id,
        tag: this.tag
      };
    };

    return Tag;

  })();

  Comment = (function() {
    function Comment(json) {
      this.description = json.description;
      this.comment_id = parseInt(json.note_comment_id);
      this.user = new User(json.user);
      this.created = new Date(json.created.replace(' ', 'T') + 'Z');
      this.note_id = parseInt(json.note_id);
    }

    return Comment;

  })();

  Note = (function() {
    function Note(json) {
      var comment, o;
      if (json == null) {
        json = null;
      }
      if (json != null) {
        this.note_id = parseInt(json.note_id);
        this.user = new User(json.user);
        this.description = json.description;
        this.photo_url = parseInt(json.media.data.media_id) === 0 ? null : json.media.data.url;
        this.thumb_url = parseInt(json.media.data.media_id) === 0 ? null : json.media.data.thumb_url;
        this.latitude = parseFloat(json.latitude);
        this.longitude = parseFloat(json.longitude);
        this.tag_id = parseInt(json.tag_id);
        this.created = new Date(json.created.replace(' ', 'T') + 'Z');
        this.player_liked = parseInt(json.player_liked) !== 0;
        this.note_likes = parseInt(json.note_likes);
        this.comments = (function() {
          var i, len, ref, results;
          ref = json.comments.data;
          results = [];
          for (i = 0, len = ref.length; i < len; i++) {
            o = ref[i];
            comment = new Comment(o);
            if (!comment.description.match(/\S/)) {
              continue;
            }
            results.push(comment);
          }
          return results;
        })();
        this.published = json.published;
      }
    }

    return Note;

  })();

  Aris = (function() {
    function Aris() {
      var authJSON;
      authJSON = window.localStorage['aris-auth'];
      this.auth = authJSON != null ? JSON.parse(authJSON) : null;
    }

    Aris.prototype.parseLogin = function(arg) {
      var returnCode, user;
      user = arg.data, returnCode = arg.returnCode;
      if (returnCode === 0 && user.user_id !== null) {
        this.auth = {
          user_id: parseInt(user.user_id),
          permission: 'read_write',
          key: user.read_write_key,
          username: user.user_name,
          display_name: user.display_name,
          media_id: user.media_id,
          email: user.email
        };
        return window.localStorage['aris-auth'] = JSON.stringify(this.auth);
      } else {
        return this.logout();
      }
    };

    Aris.prototype.login = function(username, password, cb) {
      if (cb == null) {
        cb = (function() {});
      }
      return this.call('users.logIn', {
        user_name: username,
        password: password,
        permission: 'read_write'
      }, (function(_this) {
        return function(res) {
          _this.parseLogin(res);
          return cb();
        };
      })(this));
    };

    Aris.prototype.logout = function() {
      this.auth = null;
      return window.localStorage.removeItem('aris-auth');
    };

    Aris.prototype.call = function(func, json, cb) {
      var retry;
      if (this.auth != null) {
        json.auth = this.auth;
      }
      retry = (function(_this) {
        return function(n) {
          return $.ajax({
            contentType: 'application/json',
            data: JSON.stringify(json),
            dataType: 'json',
            success: cb,
            error: function(jqxhr, status, err) {
              if (n === 0) {
                return cb([status, err]);
              } else {
                return retry(n - 1);
              }
            },
            processData: false,
            type: 'POST',
            url: ARIS_URL + "/json.php/v2." + func
          });
        };
      })(this);
      return retry(2);
    };

    Aris.prototype.callWrapped = function(func, json, cb, wrap) {
      return this.call(func, json, (function(_this) {
        return function(result) {
          if (result.returnCode === 0 && (result.data != null)) {
            result.data = wrap(result.data);
          }
          return cb(result);
        };
      })(this));
    };

    Aris.prototype.getGame = function(json, cb) {
      return this.callWrapped('games.getGame', json, cb, function(data) {
        return new Game(data);
      });
    };

    Aris.prototype.searchSiftrs = function(json, cb) {
      return this.callWrapped('games.searchSiftrs', json, cb, function(data) {
        var i, len, o, results;
        results = [];
        for (i = 0, len = data.length; i < len; i++) {
          o = data[i];
          results.push(new Game(o));
        }
        return results;
      });
    };

    Aris.prototype.getTagsForGame = function(json, cb) {
      return this.callWrapped('tags.getTagsForGame', json, cb, function(data) {
        var i, len, o, results;
        results = [];
        for (i = 0, len = data.length; i < len; i++) {
          o = data[i];
          results.push(new Tag(o));
        }
        return results;
      });
    };

    Aris.prototype.getUsersForGame = function(json, cb) {
      return this.callWrapped('users.getUsersForGame', json, cb, function(data) {
        var i, len, o, results;
        results = [];
        for (i = 0, len = data.length; i < len; i++) {
          o = data[i];
          results.push(new User(o));
        }
        return results;
      });
    };

    Aris.prototype.getGamesForUser = function(json, cb) {
      return this.callWrapped('games.getGamesForUser', json, cb, function(data) {
        var i, len, o, results;
        results = [];
        for (i = 0, len = data.length; i < len; i++) {
          o = data[i];
          results.push(new Game(o));
        }
        return results;
      });
    };

    Aris.prototype.searchNotes = function(json, cb) {
      return this.callWrapped('notes.searchNotes', json, cb, function(data) {
        var i, len, o, results;
        results = [];
        for (i = 0, len = data.length; i < len; i++) {
          o = data[i];
          results.push(new Note(o));
        }
        return results;
      });
    };

    Aris.prototype.createGame = function(game, cb) {
      return this.callWrapped('games.createGame', game.createJSON(), cb, function(data) {
        return new Game(data);
      });
    };

    Aris.prototype.updateGame = function(game, cb) {
      return this.callWrapped('games.updateGame', game.createJSON(), cb, function(data) {
        return new Game(data);
      });
    };

    Aris.prototype.getColors = function(json, cb) {
      return this.callWrapped('colors.getColors', json, cb, function(data) {
        return new Colors(data);
      });
    };

    Aris.prototype.createTag = function(tag, cb) {
      return this.callWrapped('tags.createTag', tag.createJSON(), cb, function(data) {
        return new Tag(data);
      });
    };

    Aris.prototype.updateTag = function(json, cb) {
      return this.callWrapped('tags.updateTag', json, cb, function(data) {
        return new Tag(data);
      });
    };

    Aris.prototype.createNoteComment = function(json, cb) {
      return this.callWrapped('note_comments.createNoteComment', json, cb, function(data) {
        return new Comment(data);
      });
    };

    Aris.prototype.updateNoteComment = function(json, cb) {
      return this.callWrapped('note_comments.updateNoteComment', json, cb, function(data) {
        return new Comment(data);
      });
    };

    Aris.prototype.getNoteCommentsForNote = function(json, cb) {
      return this.callWrapped('note_comments.getNoteCommentsForNote', json, cb, function(data) {
        var i, len, o, results;
        results = [];
        for (i = 0, len = data.length; i < len; i++) {
          o = data[i];
          results.push(new Comment(o));
        }
        return results;
      });
    };

    return Aris;

  })();

  ref = {
    Game: Game,
    User: User,
    Tag: Tag,
    Comment: Comment,
    Note: Note,
    Aris: Aris,
    ARIS_URL: ARIS_URL,
    SIFTR_URL: SIFTR_URL
  };
  for (k in ref) {
    v = ref[k];
    exports[k] = v;
  }

}).call(this);
