function getAuthObject() {
    return {
        user_id: model.playerId,
        permission: 'read_write',
        key: model.readWriteKey,
    };
}

function Model() {
    self = this;
    this.gameId = parseInt( window.location.search.replace('?', '') );
    if (isNaN(this.gameId)) this.gameId = DEFAULT_SIFTR_ID;

    this.displayName = ""; // for displaying newly added content
    this.gameNotes = []; //this is using new API
    this.currentNote = {};
    this.currentNote.noteId = 0;
    this.audio_context = '';
    this.recorder = '';
    this.contentWaitingToUpload = 0; // when user uploads multiple contents, you'll have to wait till all are uploaded before you can push it to HTML
    this.mapMarkers = [];
    this.tags = '';
    this.serverCallsToLoad = 0; //right now, we have 5 consecutive server calls for icon URLS, all must complete before we can continue
    this.loadFinishCallback = '';
    this.siftTypeCode = 0; //we keep track of this so we can sift from tag or search changes without forgetting what main sift we were using. Start with top

    self.playerId = 0;

    this.finishLoad = function(callback) {
        //dynamically load the tags and their icon urls from the server

        if (callback) //this is set when it's called from index
        {
            this.loadFinishCallback = callback;
            callService2("games.getGame", function(gameData){
                ABOUT_SIFTR = gameData.data.description;
                $('#p-about-siftr').html(gameData.data.description);
                if (gameData.data.map_latitude !== '0' || gameData.data.map_longitude !== '0') {
                    MAP_CENTER_LATITUDE  = parseFloat(gameData.data.map_latitude  );
                    MAP_CENTER_LONGITUDE = parseFloat(gameData.data.map_longitude );
                    MAP_ZOOM_LEVEL       = parseFloat(gameData.data.map_zoom_level);
                    // center map
                    var map_center = new google.maps.LatLng(MAP_CENTER_LATITUDE, MAP_CENTER_LONGITUDE);
                    model.views.gmap.setCenter(map_center);
                    model.views.gmap.setZoom(MAP_ZOOM_LEVEL);
                }
                if (gameData.data.map_zoom_level !== '0') {
                    MAP_ZOOM_LEVEL = parseFloat(gameData.data.map_zoom_level);
                }
                if (parseInt(gameData.data.icon_media_id) !== 0)
                {
                    callService2("media.getMedia", function(mediaData){
                        $('.scale_logo').attr('src', mediaData.data.url);
                    }, {
                        media_id: gameData.data.icon_media_id,
                    });
                }
                else
                {
                    $('.scale_logo').attr('src', 'assets/images/icon_logo.png');
                }
            }, {
                game_id: this.gameId,
            });
            callService2("tags.getTagsForGame", model.loadTagsFromServer, {game_id: this.gameId});
        } else //it's being called from the laodTagsFromServer's returning
        {
            this.serverCallsToLoad--; //one more is loaded
            //not untill all the server calls return can we proceed
            if (this.serverCallsToLoad <= 0) {
                this.loadFinishCallback();
            }
        }
    }


    $('.sifter-show-logout-button').hide();
    //check to see if they have a session cookie with their playerId and can skip login, if not set it to zero
    if ($.cookie("sifter") > 0) {
        self.playerId = $.cookie("sifter");
        self.displayName = $.cookie("displayName"); // Since there is no re-check from the server on page load
        self.readWriteKey = $.cookie("readWriteKey");

        $('.sifter-show-logout-button').show();
    }

    this.loadTagsFromServer = function(response) {
        //format tag array
        model.tags = response.data;

        var tagStyle = document.createElement("style");
        tagStyle.appendChild(document.createTextNode(""));
        document.head.appendChild(tagStyle);
        for (var i = 0; i < model.tags.length; i++) {
            var tag = model.tags[i];
            var url = tag.media ? tag.media.data.url : 'assets/images/icon_search.svg';
            tagStyle.sheet.insertRule(
                ".scale_tag_"+(i+1)+" { background-image: url("+url+"); background-position: 0px 0px; background-size: 100% 100%; }", 0
            );
        }

        model.loadTagCounts(model.tags);
    }

    this.loadTagCounts = function(tags) {
        if (tags.length === 0) {
            controller.showFilters();
            model.finishLoad();
            return;
        }
        callService2("tags.countObjectsWithTag", function(response) {
            tags[0].count = parseInt(response.data.count);
            model.loadTagCounts(tags.slice(1));
        }, {object_type: 'NOTE', tag_id: tags[0].tag_id});
    }

    this.addNoteFromData = function(note) {
        note.tagString = note.tag; //all notes are required to have one, and only one, tag
        note.geoloc = new google.maps.LatLng(note.latitude, note.longitude);
        this.gameNotes[this.gameNotes.length] = note;
    }

    this.populateFromData = function(rawNotes) { //the notes coming in need some processing
        this.gameNotes = []; //empty out old notes
        this.rawNotes = rawNotes;
        for (var i = 0; i < this.rawNotes.length; i++) {
            this.addNoteFromData(this.rawNotes[i]);
        }

    };

    this.deleteNote = function(searchID) {
        for (var i = 0; i < this.gameNotes.length; i++) {
            var note = this.gameNotes[i];
            if (parseInt(note.note_id, 10) === parseInt(searchID, 10)) {
                this.gameNotes.splice(i, 1); // remove gameNotes[i]
                return;
            }
        }
    };

    this.deleteComment = function(noteID, commentID) {
        noteID = parseInt(noteID, 10);
        commentID = parseInt(commentID, 10);
        for (var i = 0; i < this.gameNotes.length; i++) {
            var note = this.gameNotes[i];
            if (parseInt(note.note_id, 10) === noteID) {
                var comments = note.comments.data;
                for (var j = 0; j < comments.length; j++) {
                    var comment = comments[j];
                    if (parseInt(comment.note_comment_id) === commentID) {
                        comments.splice(j, 1); // remove comments[j]
                        return;
                    }
                }
            }
        }
    };

    this.getSiftTypeCode = function(siftType) {
        switch (siftType) {
            case "top":
                this.siftTypeCode = 0;
                break;
            case "recent":
                this.siftTypeCode = 2;
                break;
            case "popular":
                this.siftTypeCode = 1;
                break;
            case "mine":
                this.siftTypeCode = 3;
                break;
            case "tags":
                // in this case we don't change it but use the last setting
                break;
            case "search":
                // in this case we don't change it but use the last setting
                break;
        }
        console.log(siftType + " " + this.siftTypeCode);
        return (this.siftTypeCode);
    }

    this.setGMapOptions = function() {
        var screenWidth = document.body.clientWidth;
        if (screenWidth > 906) {
            //desktop
            model.views.gmap.setOptions({
                panControl: true,
                zoomControl: true,
                mapTypeControl: true,
                scaleControl: true,
                streetViewControl: false,
                overviewMapControl: false
            });
        } else if (screenWidth < 600) {
            //mobile phone
            model.views.gmap.setOptions({
                panControl: false,
                zoomControl: false,
                mapTypeControl: false,
                scaleControl: false,
                streetViewControl: false,
                overviewMapControl: false
            });
        } else {
            //big-ish tablet
            model.views.gmap.setOptions({
                panControl: false,
                zoomControl: false,
                mapTypeControl: true,
                scaleControl: false,
                streetViewControl: false,
                overviewMapControl: false
            });
        }
    }

    this.views = new function Views() {
        //Content
        //this.mainView.addEventgmao
        ('click', function(e) {
            e.stopPropagation();
        });
        //don't know why this is commented out, but if we don't need it we don't need the removeEventListeners either
        this.mainViewLeft = document.getElementById('main_view_left');
        this.createNoteViewContainer = document.getElementById('create_note_view_container');
        this.noteViewContainer = document.getElementById('note_view_container');
        this.filtersContainer = document.getElementById('filters_view_container');


        this.aboutContainer = document.getElementById('about_view_container');
        this.loginViewContainer = document.getElementById('login_view_container');
        this.joinViewContainer = document.getElementById('join_view_container');
        this.forgotViewContainer = document.getElementById('forgot_view_container');
        this.constructNoteView = document.getElementById('note_view_construct');
        this.constructNoteCreateView = document.getElementById('note_create_view_construct');


        this.constructLoginView = document.getElementById('login_view_construct');
        this.constructJoinView = document.getElementById('join_view_construct');
        this.constructForgotView = document.getElementById('forgot_view_construct');

        this.loginButton = document.getElementById('loginButton');
        this.logoutButton = document.getElementById('logoutButton');
        this.fbloginButton = document.getElementById('fbloginButton');
        this.siftMineButton = document.getElementById('siftMineButton');

        /* TODO toggle classes/use jquery */
        /*    if(self.playerId > 0){ //if the cookie indicated they are logged in
              this.loginButton.style.display = 'none'; // hide login
              this.fbloginButton.style.display = 'none'; //they are already logged in

              //check to see if they are logged into facebook and update the logout button accordingly
              if(FB.IsLoggedIn){
                console.log("facebook logged in");
                this.logoutButton.style.display = 'inline'; //They are logged in, let them log out
              
              }else{ //since they are only logged into siftr, use the siftr logout button 
                console.log("facebook not logged in");
                this.logoutButton.style.display = 'inline'; //They are logged in, let them log out
              }

            }
            else{
              this.logoutButton.style.display = 'none';
            }
        */
        this.likeIcon = '<img id="likeIcon" src="./assets/images/LikeIcon.png" height=10px; />';
        this.commentIcon = '<img src="./assets/images/CommentIcon.png" height=8px; />';
        this.noteIcon = '';

        this.darkness = document.getElementById("darkBackgroundLayer");
        this.darkness.style.display = 'none';

        //Map
        this.map = document.getElementById('main_view_map');
        var centerLoc = new google.maps.LatLng(43.081829, -89.402313);

        var myOptions = {
            zoom: 13,
            center: centerLoc,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            panControl: true,
            zoomControl: true,
            mapTypeControl: true,
            scaleControl: true,
            streetViewControl: false,
            overviewMapControl: false
        };
        this.gmap = new google.maps.Map(this.map, myOptions);

        var screenWidth = document.body.clientWidth;
        if (screenWidth > 906) {
            //desktop
            this.gmap.setOptions({
                panControl: true,
                zoomControl: true,
                mapTypeControl: true,
                scaleControl: true,
                streetViewControl: false,
                overviewMapControl: false
            });
        } else if (screenWidth < 600) {
            //mobile phone
            this.gmap.setOptions({
                panControl: false,
                zoomControl: false,
                mapTypeControl: false,
                scaleControl: false,
                streetViewControl: false,
                overviewMapControl: false
            });
        } else {
            //big-ish tablet
            this.gmap.setOptions({
                panControl: false,
                zoomControl: false,
                mapTypeControl: true,
                scaleControl: false,
                streetViewControl: false,
                overviewMapControl: false
            });
        }

        var newBoundsEvent;
        google.maps.event.addListener(this.gmap, 'bounds_changed', function() {
            if (newBoundsEvent != null) clearTimeout(newBoundsEvent); //if something is happening with newBoundsEvent, stop it
            // TODO: optimize
            newBoundsEvent = window.setTimeout(function() {

                model.views.mainViewLeft.innerHTML = '';

                var bounds = model.views.gmap.getBounds();
                var notesWithinBounds = [];
                var notesOutsideBounds = [];
                for (var i = 0; i < model.gameNotes.length; i++) {
                    if (bounds.contains(model.gameNotes[i].geoloc)) {
                        notesWithinBounds.push(model.gameNotes[i]);
                    } else {
                        notesOutsideBounds.push(model.gameNotes[i]);
                    }
                }


                for (var i = 0; i < notesWithinBounds.length; i++) {
                    var listNote = new ListNote(controller.noteSelected, notesWithinBounds[i], model.gameNotes[i].note_id);
                    if (!!listNote.html) model.views.mainViewLeft.appendChild(listNote.html);
                    //make sure it's not blank, if it is it'll crash    
                }
                for (var i = 0; i < notesOutsideBounds.length; i++) {
                    var listNote = new ListNote(controller.noteSelected, notesOutsideBounds[i], notesOutsideBounds[i].note_id);
                    if (!!listNote.html) model.views.mainViewLeft.appendChild(listNote.html);
                    //make sure it's not blank, if it is it'll crash    
                }
                var loadMoreButton = document.createElement('button');
                loadMoreButton.setAttribute('onclick', 'siftMore();');
                loadMoreButton.setAttribute('style', 'margin: 10px;');
                loadMoreButton.innerHTML = 'Load More';
                model.views.mainViewLeft.appendChild(loadMoreButton);

            }, 400);

        });

        var windowOpts;
        google.maps.event.addDomListener(window, 'resize', function() {
            if (windowOpts != null) clearTimeout(windowOpts);
            windowOpts = window.setTimeout(model.setGMapOptions(), 1000);
        });

        // marker clusterer
        var mcOptions = {
            styles: [{
                height: 53,
                url: "./assets/images/speechBubble_cluster_large.png",
                width: 41,
                anchor: [15, 17],
                fontFamily: "Helvetica, Arial"
            }, {
                height: 53,
                url: "./assets/images/speechBubble_cluster_large.png",
                width: 41,
                anchor: [15, 13],
                fontFamily: "Helvetica, Arial"
            }, {
                height: 53,
                url: "./assets/images/speechBubble_cluster_large.png",
                width: 41,
                anchor: [15, 13],
                fontFamily: "Helvetica, Arial"
            }, {
                height: 53,
                url: "./assets/images/speechBubble_cluster_large.png",
                width: 41,
                anchor: [15, 13],
                fontFamily: "Helvetica, Arial"
            }, {
                height: 53,
                url: "./assets/images/speechBubble_cluster_large.png",
                width: 41,
                anchor: [15, 13],
                fontFamily: "Helvetica, Arial"
            }]
        };

        this.markerclusterer = new MarkerClusterer(this.gmap, [], mcOptions);

        this.markerclusterer.setMinimumClusterSize(300)
    };
}
