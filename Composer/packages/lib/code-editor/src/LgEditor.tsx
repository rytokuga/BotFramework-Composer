// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useEffect } from 'react';
import { listen, MessageConnection } from 'vscode-ws-jsonrpc';
import get from 'lodash/get';
import { MonacoServices } from 'monaco-languageclient';
import { EditorDidMount } from '@monaco-editor/react';

import { registerLGLanguage } from './languages';
import { createUrl, createWebSocket, createLanguageClient, SendRequestWithRetry } from './utils/lspUtil';
import { BaseEditor, BaseEditorProps, OnInit } from './BaseEditor';
import { LGOption } from './utils';

const LG_HELP =
  'https://github.com/microsoft/BotBuilder-Samples/blob/master/experimental/language-generation/docs/lg-file-format.md';
const placeholder = `> To learn more about the LG file format, read the documentation at
> ${LG_HELP}`;

export interface LGLSPEditorProps extends BaseEditorProps {
  lgOption?: LGOption;
  languageServer?:
    | {
        host?: string;
        hostname?: string;
        port?: number | string;
        path: string;
      }
    | string;
}

const defaultLGServer = {
  path: '/lg-language-server',
};
declare global {
  interface Window {
    monacoServiceInstance: MonacoServices;
  }
}

export function LgEditor(props: LGLSPEditorProps) {
  const options = {
    quickSuggestions: true,
    wordBasedSuggestions: false,
    ...props.options,
  };

  const { lgOption, languageServer, onInit: onInitProp, ...restProps } = props;
  const lgServer = languageServer || defaultLGServer;

  let editorId = '';
  if (lgOption) {
    const { projectId, fileId, templateId } = lgOption;
    editorId = [projectId, fileId, templateId].join('/');
  }

  const [editor, setEditor] = useState<any>();

  useEffect(() => {
    if (!editor) return;

    if (!window.monacoServiceInstance) {
      window.monacoServiceInstance = MonacoServices.install(editor as any);
    }

    const uri = get(editor.getModel(), 'uri._formatted', '');
    const url = createUrl(lgServer);
    const webSocket: WebSocket = createWebSocket(url);
    listen({
      webSocket,
      onConnection: (connection: MessageConnection) => {
        const languageClient = createLanguageClient('LG Language Client', ['botbuilderlg'], connection);
        SendRequestWithRetry(languageClient, 'initializeDocuments', { lgOption, uri });
        const disposable = languageClient.start();
        connection.onClose(() => disposable.dispose());
      },
    });
  }, [editor]);

  const onInit: OnInit = (monaco) => {
    registerLGLanguage(monaco);

    if (typeof onInitProp === 'function') {
      onInitProp(monaco);
    }
  };

  const editorDidMount: EditorDidMount = (_getValue, editor) => {
    setEditor(editor);
    if (typeof props.editorDidMount === 'function') {
      return props.editorDidMount(_getValue, editor);
    }
  };

  return (
    <BaseEditor
      helpURL={LG_HELP}
      id={editorId}
      placeholder={placeholder}
      {...restProps}
      editorDidMount={editorDidMount}
      language="botbuilderlg"
      options={options}
      theme="lgtheme"
      onInit={onInit}
    />
  );
}
