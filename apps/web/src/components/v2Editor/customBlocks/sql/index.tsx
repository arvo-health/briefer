import {
  PlayIcon,
  StopIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  SparklesIcon,
  ChartBarIcon,
  BookOpenIcon,
} from '@heroicons/react/20/solid'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as Y from 'yjs'
import {
  type SQLBlock,
  setTitle,
  toggleSQLEditWithAIPromptOpen,
  isSQLBlockEditWithAIPromptOpen,
  closeSQLEditWithAIPrompt,
  updateYText,
  YBlockGroup,
  YBlock,
  BlockType,
  addGroupedBlock,
  getSQLAttributes,
  createComponentState,
  ExecutionQueue,
  AITasks,
  isExecutionStatusLoading,
} from '@briefer/editor'
import SQLResult from './SQLResult'
import type {
  ApiDocument,
  ApiWorkspace,
  DataSourceType,
} from '@briefer/database'
import DataframeNameInput from './DataframeNameInput'
import HeaderSelect from '@/components/v2Editor/customBlocks/sql/HeaderSelect'
import clsx from 'clsx'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import {
  LoadingEnvText,
  LoadingQueryText,
  QuerySucceededText,
} from '@/components/ExecutionStatusText'
import { ConnectDragPreview } from 'react-dnd'
import EditWithAIForm from '../../EditWithAIForm'
import ApproveDiffButons from '../../ApproveDiffButtons'
import { SQLExecTooltip } from '../../ExecTooltip'
import LargeSpinner from '@/components/LargeSpinner'
import { APIDataSources } from '@/hooks/useDatasources'
import { useRouter } from 'next/router'
import HiddenInPublishedButton from '../../HiddenInPublishedButton'
import useEditorAwareness from '@/hooks/useEditorAwareness'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import useProperties from '@/hooks/useProperties'
import { SaveReusableComponentButton } from '@/components/ReusableComponents'
import { useReusableComponents } from '@/hooks/useReusableComponents'
import { CodeEditor } from '../../CodeEditor'
import SQLQueryConfigurationButton from './SQLQueryConfigurationButton'
import { exhaustiveCheck, SQLQueryConfiguration } from '@briefer/types'
import { useBlockExecutions } from '@/hooks/useBlockExecution'
import { head } from 'ramda'
import { useAITasks } from '@/hooks/useAITasks'

interface Props {
  block: Y.XmlElement<SQLBlock>
  layout: Y.Array<YBlockGroup>
  blocks: Y.Map<YBlock>
  dataSources: APIDataSources
  document: ApiDocument
  isEditable: boolean
  isPublicMode: boolean
  dragPreview: ConnectDragPreview | null
  dashboardMode: 'live' | 'editing' | 'none'
  hasMultipleTabs: boolean
  isBlockHiddenInPublished: boolean
  onToggleIsBlockHiddenInPublished: (blockId: string) => void
  onSchemaExplorer: (dataSourceId: string | null) => void
  insertBelow: () => void
  executionQueue: ExecutionQueue
  userId: string | null
  aiTasks: AITasks
}
function SQLBlock(props: Props) {
  const properties = useProperties()
  const [workspaces] = useWorkspaces()
  const currentWorkspace: ApiWorkspace | undefined = useMemo(
    () => workspaces.data.find((w) => w.id === props.document.workspaceId),
    [workspaces.data, props.document.workspaceId]
  )

  const hasOaiKey = useMemo(() => {
    return (
      !properties.data?.disableCustomOpenAiKey &&
      (currentWorkspace?.secrets.hasOpenAiApiKey ?? false)
    )
  }, [currentWorkspace, properties.data])

  const toggleResultHidden = useCallback(() => {
    props.block.doc?.transact(() => {
      const currentIsResultHidden = props.block.getAttribute('isResultHidden')
      props.block.setAttribute('isResultHidden', !currentIsResultHidden)
    })
  }, [props.block])

  const toggleCodeHidden = useCallback(() => {
    props.block.doc?.transact(() => {
      const currentIsCodeHidden = props.block.getAttribute('isCodeHidden')
      props.block.setAttribute('isCodeHidden', !currentIsCodeHidden)
    })
  }, [props.block])

  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const onSQLSelectionChanged = useCallback((selectedCode: string | null) => {
    setSelectedCode(selectedCode)
  }, [])

  const {
    dataframeName,
    id: blockId,
    title,
    result,
    isCodeHidden,
    isResultHidden,
    editWithAIPrompt,
    aiSuggestions,
    dataSourceId,
    isFileDataSource,
    componentId,
  } = getSQLAttributes(props.block, props.blocks)

  const { startedAt: environmentStartedAt } = useEnvironmentStatus(
    props.document.workspaceId
  )

  const onRun = useCallback(() => {
    props.executionQueue.enqueueBlock(
      blockId,
      props.userId,
      environmentStartedAt,
      {
        _tag: 'sql',
        isSuggestion: false,
        selectedCode,
      }
    )
  }, [
    props.executionQueue,
    blockId,
    props.userId,
    environmentStartedAt,
    selectedCode,
  ])

  const onTry = useCallback(() => {
    props.executionQueue.enqueueBlock(
      blockId,
      props.userId,
      environmentStartedAt,
      {
        _tag: 'sql',
        isSuggestion: true,
        selectedCode,
      }
    )
  }, [
    props.executionQueue,
    blockId,
    props.userId,
    environmentStartedAt,
    selectedCode,
  ])

  const executions = useBlockExecutions(
    props.executionQueue,
    props.block,
    'sql'
  )
  const execution = head(executions) ?? null
  const status = execution?.item.getStatus() ?? { _tag: 'idle' }

  const statusIsDisabled: boolean = (() => {
    switch (status._tag) {
      case 'idle':
      case 'completed':
      case 'unknown':
        return false
      case 'running':
      case 'enqueued':
      case 'aborting':
        return true
    }
  })()

  const onToggleEditWithAIPromptOpen = useCallback(() => {
    if (!hasOaiKey) {
      return
    }

    toggleSQLEditWithAIPromptOpen(props.block)
  }, [props.block, hasOaiKey])

  const dataSource = useMemo(
    () => props.dataSources.find((d) => d.config.data.id === dataSourceId),
    [props.dataSources, dataSourceId]
  )

  const [
    { data: components },
    { create: createReusableComponent, update: updateReusableComponent },
  ] = useReusableComponents(props.document.workspaceId)
  const component = useMemo(
    () => components.find((c) => c.id === componentId),
    [components, componentId]
  )

  const editAITasks = useAITasks(props.aiTasks, props.block, 'edit-sql')
  const fixAITasks = useAITasks(props.aiTasks, props.block, 'fix-sql')
  const aiTask = useMemo(
    () => head(editAITasks.concat(fixAITasks)) ?? null,
    [editAITasks, fixAITasks]
  )

  const isAIEditing =
    aiTask?.getMetadata()._tag === 'edit-sql'
      ? isExecutionStatusLoading(aiTask.getStatus()._tag)
      : false
  const isAIFixing =
    aiTask?.getMetadata()._tag === 'fix-sql'
      ? isExecutionStatusLoading(aiTask.getStatus()._tag)
      : false

  const [editorState, editorAPI] = useEditorAwareness()

  const onCloseEditWithAIPrompt = useCallback(() => {
    if (aiTask?.getMetadata()._tag === 'edit-sql') {
      aiTask.setAborting()
    }

    closeSQLEditWithAIPrompt(props.block, false)
    editorAPI.insert(blockId, { scrollIntoView: false })
  }, [props.block, editorAPI.insert, blockId, aiTask])

  const onChangeDataSource = useCallback(
    (df: { value: string; type: DataSourceType | 'duckdb' }) => {
      if (df.type === 'duckdb') {
        props.block.setAttribute('dataSourceId', null)
        props.block.setAttribute('isFileDataSource', true)
      } else {
        props.block.setAttribute('dataSourceId', df.value)
        props.block.setAttribute('isFileDataSource', false)
      }
    },
    [props.block]
  )

  const { status: envStatus, loading: envLoading } = useEnvironmentStatus(
    props.document.workspaceId
  )

  const onChangeTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(props.block, e.target.value)
    },
    [props.block]
  )

  const onRunAbort = useCallback(() => {
    switch (status._tag) {
      case 'enqueued':
      case 'running':
        execution?.item.setAborting()
        break
      case 'idle':
      case 'completed':
      case 'unknown':
        onRun()
        break
      case 'aborting':
        break
      default:
        exhaustiveCheck(status)
    }
  }, [status, execution, onRun])

  const { source, configuration } = getSQLAttributes(props.block, props.blocks)
  const lastQuery = props.block.getAttribute('lastQuery')
  const startQueryTime = props.block.getAttribute('startQueryTime')
  const lastQueryTime = props.block.getAttribute('lastQueryTime')
  const queryStatusText = useMemo(() => {
    switch (status._tag) {
      case 'idle':
      case 'completed': {
        if (source?.toJSON() === lastQuery && lastQueryTime) {
          return <QuerySucceededText lastExecutionTime={lastQueryTime} />
        }

        return null
      }
      case 'running':
      case 'enqueued':
      case 'aborting':
        if (envStatus === 'Starting') {
          return <LoadingEnvText />
        }
        return <LoadingQueryText startExecutionTime={startQueryTime ?? null} />
      case 'unknown':
        return null
    }
  }, [
    status,
    startQueryTime,
    lastQuery,
    lastQueryTime,
    source.toJSON(),
    envStatus,
  ])

  const onSubmitEditWithAI = useCallback(() => {
    props.aiTasks.enqueue(blockId, props.userId, { _tag: 'edit-sql' })
  }, [props.aiTasks, blockId, props.userId])

  const onAcceptAISuggestion = useCallback(() => {
    if (aiSuggestions) {
      updateYText(source, aiSuggestions.toString())
    }

    props.block.setAttribute('aiSuggestions', null)
  }, [props.block, aiSuggestions, source])

  const onRejectAISuggestion = useCallback(() => {
    props.block.setAttribute('aiSuggestions', null)
  }, [props.block])

  const onFixWithAI = useCallback(() => {
    if (!hasOaiKey) {
      return
    }

    if (aiTask?.getMetadata()._tag === 'fix-sql') {
      aiTask.setAborting()
    } else {
      props.aiTasks.enqueue(blockId, props.userId, { _tag: 'fix-sql' })
    }
  }, [props.aiTasks, blockId, props.userId, hasOaiKey, aiTask])

  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => {
        setCopied(false)
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [copied, setCopied])

  const diffButtonsVisible =
    !props.isPublicMode && aiSuggestions !== null && status._tag === 'idle'

  const router = useRouter()
  const onAddDataSource = useCallback(() => {
    router.push(`/workspaces/${props.document.workspaceId}/data-sources`)
  }, [router, props.document.workspaceId])

  const onToggleIsBlockHiddenInPublished = useCallback(() => {
    props.onToggleIsBlockHiddenInPublished(blockId)
  }, [props.onToggleIsBlockHiddenInPublished, blockId])

  const onSchemaExplorer = useCallback(() => {
    props.onSchemaExplorer(dataSourceId)
  }, [props.onSchemaExplorer, dataSourceId])

  const onClickWithin = useCallback(() => {
    editorAPI.focus(blockId, { scrollIntoView: false })
  }, [blockId, editorAPI.focus])

  const dataSourcesOptions = useMemo(
    () =>
      props.dataSources
        .map((d) => ({
          value: d.config.data.id,
          label: d.config.data.name,
          type: d.config.type,
          isDemo: d.config.data.isDemo,
        }))
        .toArray(),
    [props.dataSources]
  )

  const isComponentInstance =
    component !== undefined && component.blockId !== blockId

  const onSaveReusableComponent = useCallback(() => {
    const component = components.find((c) => c.id === componentId)
    if (!component) {
      const { id: componentId, state } = createComponentState(
        props.block,
        props.blocks
      )
      createReusableComponent(
        props.document.workspaceId,
        {
          id: componentId,
          blockId,
          documentId: props.document.id,
          state,
          title,
          type: 'sql',
        },
        props.document.title
      )
    } else if (!isComponentInstance) {
      // can only update component if it is not an instance
      updateReusableComponent(props.document.workspaceId, component.id, {
        state: createComponentState(props.block, props.blocks).state,
        title,
      })
    }
  }, [
    createReusableComponent,
    props.document.workspaceId,
    blockId,
    props.document.id,
    title,
    props.block,
    components,
    isComponentInstance,
    props.document.title,
  ])

  const onChangeConfiguration = useCallback(
    (value: SQLQueryConfiguration) => {
      props.block.setAttribute('configuration', value)
    },
    [props.block]
  )

  if (props.dashboardMode !== 'none') {
    if (!result) {
      return (
        <div className="flex items-center justify-center h-full">
          {status._tag !== 'idle' ? (
            <LargeSpinner color="#b8f229" />
          ) : (
            <div className="text-gray-500">No query results</div>
          )}
        </div>
      )
    }

    return (
      <SQLResult
        result={result}
        isPublic={props.isPublicMode}
        documentId={props.document.id}
        workspaceId={props.document.workspaceId}
        blockId={blockId}
        dataframeName={dataframeName?.value ?? ''}
        isResultHidden={isResultHidden ?? false}
        toggleResultHidden={toggleResultHidden}
        isFixingWithAI={isAIFixing}
        onFixWithAI={onFixWithAI}
        dashboardMode={props.dashboardMode}
        canFixWithAI={hasOaiKey}
      />
    )
  }

  const headerSelectValue = isFileDataSource ? 'duckdb' : dataSourceId

  const isEditorFocused = editorState.cursorBlockId === blockId

  return (
    <div
      className="relative group/block"
      onClick={onClickWithin}
      data-block-id={blockId}
    >
      <div
        className={clsx(
          'rounded-md border',
          props.isBlockHiddenInPublished && 'border-dashed',
          props.hasMultipleTabs ? 'rounded-tl-none' : 'rounded-tl-md',
          {
            'border-ceramic-400 shadow-sm':
              isEditorFocused && editorState.mode === 'insert',
            'border-blue-400 shadow-sm':
              isEditorFocused && editorState.mode === 'normal',
            'border-gray-200': !isEditorFocused,
          }
        )}
      >
        <div
          className={clsx(
            'rounded-md',
            statusIsDisabled ? 'bg-gray-100' : 'bg-white',
            props.hasMultipleTabs ? 'rounded-tl-none' : ''
          )}
        >
          <div
            className="py-3"
            ref={(d) => {
              props.dragPreview?.(d)
            }}
          >
            <div className="flex items-center justify-between px-3 pr-3 gap-x-4 font-sans h-[1.6rem]">
              <div className="select-none text-gray-300 text-xs flex items-center w-full h-full">
                <button
                  className="print:hidden h-4 w-4 hover:text-gray-400 rounded-sm mr-0.5"
                  onClick={toggleCodeHidden}
                >
                  {isCodeHidden ? <ChevronRightIcon /> : <ChevronDownIcon />}
                </button>
                <input
                  type="text"
                  className={clsx(
                    'font-sans pl-1 ring-gray-200 focus:ring-gray-400 block w-full rounded-md border-0 text-gray-500 hover:ring-1 focus:ring-1 ring-inset focus:ring-inset placeholder:text-gray-400 focus:ring-inset h-full py-0 text-xs disabled:ring-0 h-full bg-transparent'
                  )}
                  placeholder="SQL"
                  value={title}
                  onChange={onChangeTitle}
                  disabled={!props.isEditable}
                />
              </div>
              <div
                className={clsx(
                  'print:hidden flex items-center gap-x-2 group-focus/block:opacity-100 h-full',
                  {
                    hidden: isCodeHidden,
                  }
                )}
              >
                <DataframeNameInput
                  disabled={!props.isEditable || statusIsDisabled}
                  block={props.block}
                  environmentStartedAt={environmentStartedAt}
                  userId={props.userId}
                  executionQueue={props.executionQueue}
                />
                <HeaderSelect
                  hidden={props.isPublicMode}
                  value={headerSelectValue ?? ''}
                  options={dataSourcesOptions}
                  onChange={onChangeDataSource}
                  disabled={!props.isEditable || statusIsDisabled}
                  onAdd={
                    props.dataSources.size === 0 ? onAddDataSource : undefined
                  }
                  onAddLabel={
                    props.dataSources.size === 0 ? 'New data source' : undefined
                  }
                />
              </div>

              <div
                className={clsx(
                  'print:hidden flex items-center gap-x-1 text-[10px] text-gray-400 whitespace-nowrap',
                  {
                    hidden: !isCodeHidden && dataframeName?.value,
                  }
                )}
              >
                <CopyToClipboard
                  text={dataframeName?.value ?? ''}
                  onCopy={() => setCopied(true)}
                >
                  <code className="bg-primary-500/20 text-primary-700 px-1.5 py-0.5 font-mono rounded-md relative group cursor-pointer">
                    {copied ? 'Copied!' : dataframeName?.value}

                    <div className="font-sans pointer-events-none absolute -top-2 right-0 -translate-y-full opacity-0 transition-opacity scale-0 group-hover:scale-100 group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1 w-56 whitespace-normal z-20">
                      <span className="text-gray-400 text-center">
                        Use this variable name to reference the results as a
                        Pandas dataframe in further Python blocks.{' '}
                        <span className="underline">Click to copy</span>.
                      </span>
                    </div>
                  </code>
                </CopyToClipboard>
              </div>
            </div>
          </div>
          <div
            className={clsx(
              'print:hidden',
              isCodeHidden ? 'invisible h-0 overflow-hidden' : 'py-5'
            )}
          >
            <div>
              <CodeEditor
                workspaceId={props.document.workspaceId}
                documentId={props.document.id}
                blockId={blockId}
                source={source}
                language="sql"
                readOnly={!props.isEditable || statusIsDisabled}
                onEditWithAI={onToggleEditWithAIPromptOpen}
                onRun={onRun}
                onInsertBlock={props.insertBelow}
                diff={aiSuggestions ?? undefined}
                dataSourceId={dataSourceId}
                disabled={statusIsDisabled}
                onSelectionChanged={onSQLSelectionChanged}
              />
            </div>
          </div>
          <ApproveDiffButons
            visible={diffButtonsVisible}
            canTry={status._tag === 'idle'}
            onTry={onTry}
            onAccept={onAcceptAISuggestion}
            onReject={onRejectAISuggestion}
          />
          {isSQLBlockEditWithAIPromptOpen(props.block) &&
          !props.isPublicMode ? (
            <EditWithAIForm
              loading={isAIEditing}
              disabled={isAIEditing || aiSuggestions !== null}
              onSubmit={onSubmitEditWithAI}
              onClose={onCloseEditWithAIPrompt}
              value={editWithAIPrompt}
              hasOutput={result !== null}
            />
          ) : (
            <div
              className={clsx('print:hidden px-3 pb-3', {
                hidden: isCodeHidden,
              })}
            >
              <div className="flex justify-between text-xs">
                <div className="flex items-center">{queryStatusText}</div>
                <div className="flex items-center gap-x-2">
                  {!props.isPublicMode &&
                    aiSuggestions === null &&
                    props.isEditable &&
                    !isAIFixing &&
                    headerSelectValue !== 'duckdb' && (
                      <button
                        onClick={onSchemaExplorer}
                        className={clsx(
                          !props.isEditable
                            ? 'cursor-not-allowed bg-gray-200'
                            : 'cusor-pointer hover:bg-gray-50 hover:text-gray-700',
                          'flex items-center border rounded-sm border-gray-200 px-2 py-1 gap-x-2 text-gray-400 group relative font-sans'
                        )}
                      >
                        <BookOpenIcon className="w-3 h-3" />
                        <span>Schema</span>
                      </button>
                    )}

                  {!props.isPublicMode &&
                    aiSuggestions === null &&
                    props.isEditable &&
                    !isAIFixing && (
                      <button
                        disabled={!props.isEditable}
                        onClick={onToggleEditWithAIPromptOpen}
                        className={clsx(
                          !props.isEditable || !hasOaiKey
                            ? 'cursor-not-allowed bg-gray-200'
                            : 'cusor-pointer hover:bg-gray-50 hover:text-gray-700',
                          'flex items-center border rounded-sm border-gray-200 px-2 py-1 gap-x-2 text-gray-400 group relative font-sans'
                        )}
                      >
                        <SparklesIcon className="w-3 h-3" />

                        <span>Edit with AI</span>
                        <div
                          className={clsx(
                            'font-sans pointer-events-none absolute -top-2 left-1/2 -translate-y-full -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col items-center justify-center gap-y-1 z-30',
                            hasOaiKey ? 'w-28' : 'w-40'
                          )}
                        >
                          <span>
                            {hasOaiKey
                              ? 'Open AI edit form'
                              : 'Missing OpenAI API key'}
                          </span>
                          <span className="inline-flex gap-x-1 items-center text-gray-400">
                            {hasOaiKey ? (
                              <>
                                <span>⌘</span>
                                <span>+</span>
                                <span>e</span>
                              </>
                            ) : (
                              <span>
                                Admins can add an OpenAI key in settings.
                              </span>
                            )}
                          </span>
                        </div>
                      </button>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
        {result && (
          <SQLResult
            result={result}
            isPublic={false}
            documentId={props.document.id}
            workspaceId={props.document.workspaceId}
            blockId={blockId}
            dataframeName={dataframeName?.value ?? ''}
            isResultHidden={isResultHidden ?? false}
            toggleResultHidden={toggleResultHidden}
            isFixingWithAI={isAIFixing}
            onFixWithAI={onFixWithAI}
            dashboardMode={props.dashboardMode}
            canFixWithAI={hasOaiKey}
          />
        )}
      </div>
      <div
        className={clsx(
          'absolute h-full transition-opacity opacity-0 group-hover/block:opacity-100 pl-1.5 right-0 top-0 translate-x-full flex flex-col gap-y-1',
          isEditorFocused || statusIsDisabled ? 'opacity-100' : 'opacity-0',
          !props.isEditable ? 'hidden' : 'block'
        )}
      >
        <button
          onClick={onRunAbort}
          disabled={status._tag !== 'idle' && status._tag !== 'running'}
          className={clsx(
            {
              'bg-gray-200 cursor-not-allowed':
                status._tag !== 'idle' && status._tag !== 'running',
              'bg-red-200':
                status._tag === 'running' && envStatus === 'Running',
              'bg-yellow-300':
                status._tag === 'running' && envStatus !== 'Running',
              'bg-primary-200': status._tag === 'idle',
            },
            'rounded-sm h-6 min-w-6 flex items-center justify-center relative group'
          )}
        >
          {status._tag !== 'idle' ? (
            <div>
              {status._tag === 'enqueued' ? (
                <ClockIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <StopIcon className="w-3 h-3 text-gray-500" />
              )}
              <SQLExecTooltip
                envStatus={envStatus}
                envLoading={envLoading}
                execStatus={status._tag === 'enqueued' ? 'enqueued' : 'running'}
                runningAll={execution?.batch.isRunAll() ?? false}
              />
            </div>
          ) : props.dataSources.size > 0 || headerSelectValue === 'duckdb' ? (
            <RunQueryTooltip />
          ) : (
            <MissingDataSourceTooltip />
          )}
        </button>
        {((result && !isResultHidden) || !isCodeHidden) && (
          <ToChartButton
            layout={props.layout}
            block={props.block}
            blocks={props.blocks}
          />
        )}

        <HiddenInPublishedButton
          isBlockHiddenInPublished={props.isBlockHiddenInPublished}
          onToggleIsBlockHiddenInPublished={onToggleIsBlockHiddenInPublished}
          hasMultipleTabs={props.hasMultipleTabs}
        />

        {((result && !isResultHidden) || !isCodeHidden) && (
          <SaveReusableComponentButton
            isComponent={blockId === component?.blockId}
            onSave={onSaveReusableComponent}
            disabled={!props.isEditable || isComponentInstance}
            isComponentInstance={isComponentInstance}
          />
        )}

        {((result && !isResultHidden) || !isCodeHidden) &&
          dataSource?.config.type === 'athena' && (
            <SQLQueryConfigurationButton
              dataSource={dataSource}
              value={configuration}
              onChange={onChangeConfiguration}
              disabled={!props.isEditable}
            />
          )}
      </div>
    </div>
  )
}

type ToChartButtonProps = {
  layout: Y.Array<YBlockGroup>
  block: Y.XmlElement<SQLBlock>
  blocks: Y.Map<YBlock>
}
const ToChartButton = (props: ToChartButtonProps) => {
  const onAdd = useCallback(() => {
    const blockId = props.block.getAttribute('id')

    const blockGroup = props.layout.toArray().find((blockGroup) => {
      return blockGroup
        .getAttribute('tabs')
        ?.toArray()
        .some((tab) => {
          return tab.getAttribute('id') === blockId
        })
    })
    const blockGroupId = blockGroup?.getAttribute('id')

    if (!blockId || !blockGroupId) {
      return
    }

    addGroupedBlock(
      props.layout,
      props.blocks,
      blockGroupId,
      blockId,
      {
        type: BlockType.Visualization,
        dataframeName: props.block.getAttribute('dataframeName')?.value ?? null,
      },
      'after'
    )
  }, [props.layout, props.blocks, props.block])

  const isDisabled = props.block.getAttribute('result')?.type !== 'success'

  return (
    <button
      onClick={onAdd}
      className="rounded-sm border border-gray-200 h-6 min-w-6 flex items-center justify-center relative group hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-200"
      disabled={isDisabled}
    >
      <ChartBarIcon className="w-3 h-3 text-gray-400 group-hover:text-gray-500" />
      <div className="font-sans pointer-events-none absolute -top-1 left-1/2 -translate-y-full -translate-x-1/2 w-max opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1 max-w-40">
        <span>Create visualization</span>
        <span className="inline-flex items-center text-gray-400">
          {isDisabled
            ? 'Run a successful query before creating a visualization.'
            : "Create graphs based on this query's results."}
        </span>
      </div>
    </button>
  )
}

const MissingDataSourceTooltip = () => {
  return (
    <div>
      <PlayIcon className="w-3 h-3 text-gray-500" />
      <div className="font-sans pointer-events-none absolute -top-1 left-1/2 -translate-y-full -translate-x-1/2 w-max opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1">
        <span>No data sources.</span>
        <span className="inline-flex items-center text-gray-400">
          Add a data source to run queries.
        </span>
      </div>
    </div>
  )
}

const RunQueryTooltip = () => {
  return (
    <div>
      <PlayIcon className="w-3 h-3 text-gray-500" />
      <div className="font-sans pointer-events-none absolute -top-1 left-1/2 -translate-y-full -translate-x-1/2 w-max opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1">
        <span>Run query</span>
        <span className="inline-flex gap-x-1 items-center text-gray-400">
          <span>⌘</span>
          <span>+</span>
          <span>Enter</span>
        </span>
      </div>
    </div>
  )
}

export default SQLBlock
