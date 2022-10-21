import React, {useState, useCallback, useEffect, useMemo} from 'react';
import logo from './logo.svg';
import './App.css';

const App = () => {

  // Check if userid is already in local storage.
  // If userid exists, try to retrieve username (user info) and service status from backend.
  const userid = useMemo(() => {
    const userid = window.localStorage.getItem('userid');
    console.log(`userid=${userid}`);
    return userid;
  }, []);

  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');

  const authorizeLine = useCallback(() => {
    console.log('Start LINE login.');

    const clientId = process.env.REACT_APP_LINE_CLIENT_ID;
    const callback = `${process.env.REACT_APP_LINE_BACKEND_SERVER}/v1/linecallback`;
    const state = '12345'; // TODO: to be a random number?
    const scope = [ 'profile', 'openid' ]
    const nonce = "09876xyz"; // TODO: to be a random number?
  
    const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code` +
                    `&client_id=${clientId}` +
                    `&redirect_uri=${encodeURI(callback)}` +
                    `&state=${state}` +
                    `&scope=${encodeURI(scope.join(' '))}` +
                    `&nonce=${nonce}`;

    // Redirect to login page.
    window.location.href = url;
  }, []);

  // LINE Bot Login.  (SSO with LINE but use different access_token to operate LINE Notify)
  const authorizeLineBot = useCallback(() => {
    console.log('Start LINE Bot login.');
    if (!userid) {
      console.log('Please login.');
      return;
    }
    // We pass "userid" as "state" so the backend can find the correct LINE user.
    // Therefore, we must complete LINE login and receive the userid first.

    const clientId = process.env.REACT_APP_LINE_BOT_CLIENT_ID;
    const callback = `${process.env.REACT_APP_LINE_BACKEND_SERVER}/v1/linebotcallback`;

    const url = `https://notify-bot.line.me/oauth/authorize?response_type=code` +
                    `&client_id=${clientId}` +
                    `&redirect_uri=${encodeURI(callback)}` + 
                    `&scope=notify` +
                    `&state=${userid}`;

    // Redirect to login page.
    window.location.href = url;
  }, []);

  const getUsername = useCallback(() => {
    console.log('Get username (from LINE login info)');
    if (!userid) {
      console.log('Please login.');
      return;
    }
    fetch(`${process.env.REACT_APP_LINE_BACKEND_SERVER}/v1/username?userId=${userid}`, {
      method: "GET"
    })
    .then(response => response.text())
    .then(data => {
      console.log(`username = '${data}'`)
      setUsername(data);
      if (data === '') {
        window.localStorage.removeItem('userid');
      }
    })
    .catch(error => {
      console.error(error);
    });
  }, [userid]);

  const checkStatus = useCallback(() => {
    console.log('Check LINE Notify registration service status.');
    if (!userid) {
      console.log('Please login.');
      return;
    }
    fetch(`${process.env.REACT_APP_LINE_BACKEND_SERVER}/v1/user/${userid}/status`, {
      method: "GET"
    })
    .then(response => response.json())
    .then(json => {
      console.log(json)
      if (json.status === 200) {
        setStatus("OK");
      } else {
        setStatus("Disabled");
      }
    })
    .catch(error => {
      console.log(error)
    });
  }, [userid]);

  const revokeService = useCallback(() => {
    console.log('Revoke LINE Notify service.');
    fetch(`${process.env.REACT_APP_LINE_BACKEND_SERVER}/v1/user/${userid}`, {
      method: "PUT"
    })
    .then(response => response.json())
    .then(json => {
      console.log(json)
      if (json.status === 200) {
        setStatus("Disabled");
      }
    })
    .catch(error => {
      console.log(error)
    })
  }, [userid]);

  const logout = useCallback(() => {
    console.log('Logout LINE.');
    fetch(`${process.env.REACT_APP_LINE_BACKEND_SERVER}/v1/user/${userid}`, {
      method: "DELETE"
    })
    .then(response => response.json())
    .then(json => {
      console.log(json)
      if (json.status === 200) {
        setStatus("Disabled");
      }
    })
    .catch(error => {
      console.log(error)
    })
  }, [userid]);

  useEffect(() => {
    getUsername();
    checkStatus();
  }, [getUsername, checkStatus]);

  // Handling callback from backend.
  if (window.location.hash.startsWith('#callback=line&')) {
    console.log('Receive the redirection from backend after LINE login success, extract the userid and save it to local storage.');
    const s = window.location.hash.replace(/^#/, '');
    s.split('&').forEach((item) => {
      const [key, value] = item.split('=');
      console.log(key + ' ' + value);
      if (key === 'userid') {
        let userid = value;
        console.log('Save userid to local storage.');
        window.localStorage.setItem('userid', userid);
      }
    })

    if (process.env.REACT_APP_AUTO_REGISTER_AFTER_LOGIN) {
      authorizeLineBot();
    } else {
      console.log('Redirect again to clear out the access token from url.');
      window.location.href = window.location.origin;
    }
  } else if (window.location.hash === '#callback=linebot') {
    console.log('Receive the redirection from backend after LINE BOT login success.');
    checkStatus();

    console.log('Redirect again to clear out the access token from url.');
    window.location.href = window.location.origin;
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        {
          !username && <div className="App-link" onClick={() => authorizeLine()}>Login with LINE</div>
        }
        {
          username && (
            <>
              <div>LINE User: {username}</div>
              <div className="App-link" onClick={() => logout()}>Logout</div>
              <div>LINE Notify Service Status: {status}</div>
              <div className="App-link" onClick={() => checkStatus()}>Check Service Status</div>
              {
                status !== "OK" && <div className="App-link" onClick={() => { authorizeLineBot(userid) }}>Register LINE Notify</div>
              }
              {
                status === "OK" && <div className="App-link" onClick={() => revokeService()}>Revoke Service</div>
              }
            </>
          )
        }
      </header>
    </div>
  );
};

export default App;
