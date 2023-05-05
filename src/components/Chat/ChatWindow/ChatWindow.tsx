import "./ChatWindow.css";
import { SocketIO } from "../../socket-io/socket-io";
import { Socket } from "socket.io-client";
import { store } from "../../Redux/store";
import { useEffect, useReducer, useState, useRef } from "react";
import { useDispatch } from "react-redux";
import { setConnection } from "../../Redux/ClientRedux";
import { ChatUser, GroupChat, User, GroupChatMessage } from "../../Model and Interfaces/Models";
import { filterGroups, getChats, getGroupChats, getGroupList, getUsersRegistered, provideClassPlacement, provideClassPlacementGroup, provideTextHighlight, provideTextHighlightGroup } from "./commonMethods";
import { addChats, appendChat } from "../../Redux/ChatsRedux";
import { GroupModel } from "../GroupModel/GroupModel";
import { Tabs, Tab, Spinner } from "react-bootstrap";
import { addGroups, appendGroups } from "../../Redux/Groups";
import { addGroupChats, appendGroupChats } from "../../Redux/GroupChats";
import { FileModal } from "../FileTransferModal/FileModal";

export const ChatWindow = () => {
  let initialState: Map<String, User> = new Map();
  const [showModal, setShowModal] = useState(false);
  const [chats, setChats] = useState<any>();
  const [key, setKey] = useState<string | null>("tab1");
  const [currMessage, setCurrMessgae] = useState("");
  const [toUsername, setToUsername] = useState("");
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [groupToggle, setGroupToggle] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const dispatching = useDispatch();

  const reducer = (state: Map<String, User>, action: { type: string, payload: User[] }): Map<String, User> => {
    switch (action.type) {
      case "createUserList":
        let userCopy: Map<String, User> = new Map();
        if (action && action.payload) {
          action.payload.map((user) => {
            if (user && user.username != store.getState().user.username) {
              userCopy.set(user.username, user);
            }
          });
        }
        state = userCopy;
        return state;
      default:
        return state;
    }
  }

  const [state, dispatch] = useReducer(reducer, initialState);

  const getChat = () => {
    getChats().then((res: ChatUser[]) => {
      dispatching(addChats(res));
    });
  }

  useEffect(() => {
    handlejoinSocket();
  }, [store.getState().chat]);

  useEffect(() => {
    getChat();
    let socket = store.getState().socket.io;
    handlePrivateChat("", "", socket);
  }, []);

  const handlejoinSocket = async () => {
    if (store.getState().user && store.getState().user.token && store.getState().user.email && store.getState().user.username
    ) {
      let response: any = new SocketIO().init(store.getState().user.token, store.getState().user.username, store.getState().user.email);
      dispatching(setConnection(response));
      let users = await getUsersRegistered(store.getState().user.username, store.getState().user.email, store.getState().user.token);
      dispatch({ type: "createUserList", payload: users });
    }
  }

  const handleChatClick = (e: React.MouseEvent, username: string) => {
    if (username) {
      setToUsername(username);
    }
  }

  const handleSendButton = (e: any) => {
    e?.preventDefault();
    let socket: Socket = store.getState().socket.io;
    if (!groupToggle) {
      handlePrivateChat(toUsername, currMessage, socket);
    } else {
      let groupList: GroupChat[] = store.getState().group;
      let usernames: string[] = [];
      groupList.map((group) => {
        if (group && group.groupTitle == toUsername) {
          usernames = group.usernames;
        }
      });

      handleGroupChat(socket, usernames, currMessage, toUsername);
    }
  }

  const handleGroupChat = (socket: Socket, toUsername: string[], message: string, groupTitle: string) => {
    let groupChat: GroupChatMessage = {
      fromUsername: store.getState().user.username,
      toUsernames: toUsername,
      groupTitle: groupTitle,
      Id: store.getState().groupChat.get(groupTitle)?.length != undefined ? store.getState().groupChat.get(groupTitle)?.length as number + 1 : 1,
      timestamp: new Date().valueOf(),
      messageContent: message
    }
    socket.emit("group-message", groupChat);
    socket.on("group-discussion", (discussion: GroupChatMessage) => {
      setChats(discussion);
      dispatching(appendGroupChats(discussion));
      console.log(discussion);
    });
  }

  const handlePrivateChat = (toUsername: string, messageContent: string, socket: Socket) => {
    socket.emit("private-message", {
      fromUsername: store.getState().user.username,
      toUsername: toUsername,
      messageContent: currMessage,
      timeStamp: new Date().valueOf(),
      Id: store.getState().chat.length + 1
    });

    socket.on("private-chat", (message: ChatUser) => {
      dispatching(appendChat(message));
      setChats(message);
    });
  }

  const handleModal = () => {
    setShowModal(!showModal);
  }

  const handleDataFromModal = (data: GroupChat) => {
    let socket = store.getState().socket.io;
    socket.emit("group-chat", data);
    handleModal();
  }

  const handleTabClick = async (k: string | null) => {
    if (k == "tab1") {
      setGroupToggle(false);
    } else {
      setGroupToggle(true);
    }
    setKey(k);
    if (k == "tab2") {
      let groupList: GroupChat[] = await getGroupList();
      dispatching(addGroups(groupList));
      let response: GroupChat[] = filterGroups(groupList, store.getState().user.username);
      setGroups(response);
    } else {
      setGroups([]);
    }
  }

  const handleGroupClick = async (group: GroupChat) => {
    if (group && group.groupTitle) {
      let socket = store.getState().socket.io;
      socket.emit("join-group", group.groupTitle);
      handleGroupChat(socket, group.usernames, "", group.groupTitle);
      let groupChats: GroupChatMessage[] = await getGroupChats(store.getState().user.username, group.groupTitle);
      dispatching(addGroupChats(groupChats));
      setToUsername(group.groupTitle);
    }
  }

  const handleOptions = (e: any) => {
    e.preventDefault();
    setShowOptions(!showOptions);
  }

  const showModalLoader =(showModal : boolean)=>{
    setLoading(showModal);
  }

  return (
    <div className="container py-4">
      <div className="row">
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h4>Hey, {store.getState().user.username}</h4>
              <a className="btn btn-outline-dark" onClick={handleModal}>Create Group</a>
            </div>
            <div className="card-body">
              <Tabs activeKey={key && key == "tab1" ? "tab1" : "tab2"} onSelect={(k) => handleTabClick(k)} className="text-secondary">
                <Tab eventKey="tab1" title="Users">
                  <ul className="list-group">
                    {Array.from(state.values()).map((user: User, index: number) => {
                      return <li className="btn btn-outline-secondary" key={index} onClick={(e) => handleChatClick(e, user.username)}>{user.username}</li>
                    })}
                  </ul>
                </Tab>
                <Tab eventKey="tab2" title="Groups">
                  {groups.length > 0 ?
                    <ul className="list-group" style={{ marginTop: "2%" }}>
                      {groups.map((group: GroupChat, index: number) => {
                        return <li className="btn btn-outline-secondary" key={index} onClick={() => handleGroupClick(group)}>{group.groupTitle}</li>
                      })}
                    </ul> : <p style={{ marginTop: "2%" }}>No Groups Created!</p>}
                </Tab>
              </Tabs>
              <GroupModel showModal={showModal} initialState={state} handleDataFromModal={handleDataFromModal} handleModal={handleModal} />
            </div>
          </div>
        </div>
        {!groupToggle ?
          <div className="col-md-8">
            <div className={toUsername ? "card" : "card opacity-50"}>
              <div className="card-header">
                {toUsername ? <h4>Chat with {toUsername}!</h4> : <h4>Let's Beign Chat Guys!</h4>}
              </div>
              <div className="card-body chat-container">
                {toUsername ? store.getState().chat.map((chatObj: ChatUser, index: number) => {
                  return (
                    <div className="mb-3" key={index}>
                      <div className={provideClassPlacement(chatObj, toUsername)}>
                        <div className={provideTextHighlight(chatObj, toUsername)}>
                          <p>{provideTextHighlight(chatObj, toUsername) ? chatObj.messageContent : null}</p>
                        </div>
                      </div>
                    </div>
                  )
                }) : <div className="mb-3">
                  <div className="d-flex justify-content-center">
                    <div className="text-black p-2 rounded">
                      <p>Let's begin Your Chat!</p>
                    </div>
                  </div>
                </div>}

              </div>
              <div className="card-footer">
                <form>
                {isLoading && (
                    <div className="text-center my-3">
                      <Spinner animation="border" variant="primary" size="sm" />
                      <span className="mx-2">Reading file...</span>
                    </div>
                  )}
                  <div className="input-group">
                    <FileModal showModal={showOptions} showModalLoader = {showModalLoader}/>
                    <input type="text" className="form-control" placeholder="Type your message..." onChange={(e) => setCurrMessgae(e.target.value)} disabled={toUsername ? false : true} />
                    <button className="btn btn-secondary" onClick={(e) => handleOptions(e)} disabled={toUsername ? false : true}> <i className="bi bi-paperclip" style={{ fontSize: "30px" }}></i></button>
                    <button className="btn btn-primary" onClick={(e) => handleSendButton(e)} disabled={toUsername ? false : true}><i className="bi bi-arrow-up" style={{ fontSize: "30px" }} ></i></button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          :
          <div className="col-md-8">
            <div className={toUsername ? "card" : "card opacity-50"}>
              <div className="card-header">
                {toUsername ? <h4>Chat with {toUsername}!</h4> : <h4>Let's Beign Chat Guys!</h4>}
              </div>
              <div className="card-body chat-container">
                {toUsername && store.getState().groupChat.has(toUsername) ? store.getState().groupChat.get(toUsername)?.map((chatObj: GroupChatMessage, index: number) => {
                  return (
                    <div className="mb-3" key={index}>
                      <div className={provideClassPlacementGroup(chatObj, toUsername)}>
                        <div className={provideTextHighlightGroup(chatObj, toUsername)}>
                          <p>{provideTextHighlightGroup(chatObj, toUsername) ? chatObj.messageContent : null}</p>
                        </div>
                      </div>
                    </div>
                  )
                }) : <div className="mb-3">
                  <div className="d-flex justify-content-center">
                    <div className="text-black p-2 rounded">
                      <p>Let's begin Your Chat!</p>
                    </div>
                  </div>
                </div>}

              </div>
              <div className="card-footer">
                <form>
                  {isLoading && (
                    <div className="text-center my-3">
                      <Spinner animation="border" variant="primary" size="sm" />
                      <span className="mx-2">Reading file...</span>
                    </div>
                  )}
                  <div className="input-group">
                    <FileModal showModal={showOptions} showModalLoader = {showModalLoader}/>
                    <input type="text" className="form-control" placeholder="Type your message..." onChange={(e) => setCurrMessgae(e.target.value)} disabled={toUsername ? false : true} />
                    <button className="btn btn-secondary" onClick={(e) => handleOptions(e)} disabled={toUsername ? false : true}><i className="bi bi-paperclip" style={{ fontSize: "30px" }}></i></button>
                    <button className="btn btn-primary" onClick={(e) => handleSendButton(e)} disabled={toUsername ? false : true}><i className="bi bi-arrow-up" style={{ fontSize: "30px" }} ></i></button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  );
}

