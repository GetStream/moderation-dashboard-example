import React, { useState, useEffect, useCallback } from "react";
import { StreamChat } from "stream-chat";
import { Container, Header, Button, Segment, Tab, Modal, Menu, GridRow, GridColumn, Grid, Image } from "semantic-ui-react";
import debounce from "lodash/debounce";

// Update API Configuration to use environment variables
const STREAM_API_KEY = process.env.REACT_APP_STREAM_API_KEY;
const MODERATOR_USER_ID = process.env.REACT_APP_MODERATOR_USER_ID;
const MODERATOR_TOKEN = process.env.REACT_APP_MODERATOR_TOKEN;

// Validation to ensure environment variables are set
if (!STREAM_API_KEY || !MODERATOR_USER_ID || !MODERATOR_TOKEN) {
  throw new Error(
    'Please set REACT_APP_STREAM_API_KEY, REACT_APP_MODERATOR_USER_ID, and REACT_APP_MODERATOR_TOKEN environment variables'
  );
}

// Initialize Stream client
const client = StreamChat.getInstance(STREAM_API_KEY);

const App = () => {
  const [reviewQueueItems, setReviewQueueItems] = useState([]);
  const [reviewedItems, setReviewedItems] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reviewQueueCursor, setReviewQueueCursor] = useState(null);
  const [reviewedCursor, setReviewedCursor] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchItems = async (isReviewed, cursor = null) => {
    try {
      setIsLoading(true);
      const response = await client.moderation.queryReviewQueue(
        { 
          entity_type: "stream:chat:v1:message", 
          reviewed: isReviewed, 
          has_text: true 
        },
        [],
        { 
          next: cursor,
          limit: 25
        }
      );

      if (isReviewed) {
        setReviewedItems(prev => cursor ? [...prev, ...response.items] : response.items);
        setReviewedCursor(response.next);
      } else {
        setReviewQueueItems(prev => cursor ? [...prev, ...response.items] : response.items);
        setReviewQueueCursor(response.next);
      }

      console.log(`Fetched ${response.items.length} items, next cursor: ${response.next}`);
      
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await client.connectUser(
        { id: MODERATOR_USER_ID }, 
        MODERATOR_TOKEN
      );
      await Promise.all([
        fetchItems(false),
        fetchItems(true)
      ]);
    };
    initializeData();
  }, []);

  const handleScroll = useCallback(
    debounce(async () => {
      if (isLoading) return;

      const scrollPosition = window.innerHeight + window.scrollY;
      const scrollThreshold = document.documentElement.scrollHeight - 200;

      if (scrollPosition > scrollThreshold) {
        const isReviewedTab = activeTab === 1;
        const currentCursor = isReviewedTab ? reviewedCursor : reviewQueueCursor;
        
        if (currentCursor) {
          console.log('Loading more items with cursor:', currentCursor);
          await fetchItems(isReviewedTab, currentCursor);
        }
      }
    }, 300),
    [activeTab, isLoading, reviewQueueCursor, reviewedCursor]
  );

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      handleScroll.cancel();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const renderTextPreview = (texts) => {
    if (!texts || texts.length === 0) return 'No text available';
    return (
      <>
        {texts[0]}
        {texts.length > 1 && (
          <span style={{ 
            marginLeft: '8px', 
            color: '#666', 
            fontSize: '12px' 
          }}>
            +{texts.length - 1} more
          </span>
        )}
      </>
    );
  };

  const formatTimestamp = (nanoseconds) => {
    if (!nanoseconds) return 'N/A';
    const milliseconds = Math.floor(nanoseconds / 1000000);
    const date = new Date(milliseconds);
    return date.toLocaleDateString('en-GB');
  };

  const DetailModal = ({ item, open, onClose }) => {
    if (!item) return null;
    
    return (
      <Modal open={open} onClose={onClose} size="large">
        <Modal.Header>Content Details</Modal.Header>
        <Modal.Content>
          <Grid>
            <GridRow>
              {/* Flags Section */}
              {item.flags?.length > 0 && (
                <GridColumn width={16}>
                  <Header as="h3">Flags</Header>
                  <Segment>
                    {item.flags.map((flag, index) => (
                      <div key={index} style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong>{flag.type}:</strong>
                          {flag.labels && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {flag.labels.map((label, labelIndex) => (
                                <span key={labelIndex} style={{
                                  background: '#F0F0F0',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px'
                                }}>
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </Segment>
                </GridColumn>
              )}

              {/* Images Section */}
              {item.moderation_payload?.images?.length > 0 && (
                <GridColumn width={16}>
                  <Header as="h3">Images</Header>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {item.moderation_payload.images.map((image, index) => (
                      <div key={index} style={{ position: 'relative' }}>
                        <Image 
                          src={image} 
                          style={{ 
                            width: '200px', 
                            height: '200px', 
                            objectFit: 'cover',
                            borderRadius: '8px'
                          }} 
                        />
                      </div>
                    ))}
                  </div>
                </GridColumn>
              )}

              {/* Texts Section */}
              <GridColumn width={16} style={{ marginTop: '24px' }}>
                <Header as="h3">Texts</Header>
                {item.moderation_payload?.texts?.map((text, index) => (
                  <Segment key={index}>
                    <p>{text}</p>
                    {/* Add text labels here if available */}
                  </Segment>
                ))}
              </GridColumn>

              {/* User Details Section */}
              <GridColumn width={16} style={{ marginTop: '24px' }}>
                <Header as="h3">User Details</Header>
                <Grid>
                  <GridRow columns={2}>
                    <GridColumn>
                      <Segment>
                        <Header as="h4">Basic Information</Header>
                        <p><strong>Name:</strong> {item.entity_creator?.name || 'N/A'}</p>
                        <p><strong>Role:</strong> {item.entity_creator?.role || 'N/A'}</p>
                        <p>
                          <strong>Created:</strong>{' '}
                          {formatTimestamp(item.entity_creator?.created_at)}
                        </p>
                      </Segment>
                    </GridColumn>
                    <GridColumn>
                      <Segment>
                        <Header as="h4">Moderation History</Header>
                        <p><strong>Ban Count:</strong> {item.entity_creator?.ban_count || 0}</p>
                        <p><strong>Removed Content:</strong> {item.entity_creator?.removed_content_count || 0}</p>
                      </Segment>
                    </GridColumn>
                  </GridRow>
                </Grid>
              </GridColumn>
            </GridRow>
          </Grid>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={onClose}>Close</Button>
        </Modal.Actions>
      </Modal>
    );
  };

  const handleMarkReviewed = async (itemId, e) => {
    e.stopPropagation();
    try {
      await client.moderation.submitAction("mark_reviewed", itemId);
      const itemToMove = reviewQueueItems.find(item => item.id === itemId);
      setReviewQueueItems(prev => prev.filter(item => item.id !== itemId));
      if (itemToMove) {
        setReviewedItems(prev => [itemToMove, ...prev]);
      }
    } catch (error) {
      console.error('Error marking as reviewed:', error);
    }
  };

  const handleDelete = async (itemId, e) => {
    e.stopPropagation();
    try {
      await client.moderation.submitAction(
        "delete_message",
        itemId,
        { delete_message: { hard_delete: false } }
      );
      setReviewQueueItems(prev => prev.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const formatEntityType = (entityType) => {
    switch (entityType) {
      case 'stream:chat:v1:message':
        return 'Chat Message';
      case 'stream:feeds:v2:activity':
        return 'Feeds Activity';
      case 'stream:feeds:v2:reaction':
        return 'Feeds Reaction';
      default:
        return entityType;
    }
  };

  const renderItemList = (items) => (
    items.map((item) => (
      <Segment 
        key={item.id} 
        onClick={() => {
          setSelectedItem(item);
          setIsModalOpen(true);
        }}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        {/* Entity Type Tag */}
        <div style={{ 
          position: 'absolute',
          top: '12px',
          right: '12px',
        }}>
          <span style={{
            background: '#E8F4FF',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#2185d0'
          }}>
            {formatEntityType(item.entity_type)}
          </span>
        </div>

        <Grid>
          <GridRow>
            {/* Image Column */}
            {item.moderation_payload?.images?.length > 0 && (
              <GridColumn width={3}>
                <div style={{ position: 'relative' }}>
                  <Image 
                    src={item.moderation_payload.images[0]} 
                    style={{ 
                      width: '100%', 
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '4px'
                    }} 
                  />
                  {item.moderation_payload.images.length > 1 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      +{item.moderation_payload.images.length - 1} more
                    </div>
                  )}
                </div>
              </GridColumn>
            )}
            
            {/* Content Column */}
            <GridColumn width={item.moderation_payload?.images?.length > 0 ? 13 : 16}>
              <Header as="h4">
                {activeTab === 1 ? (
                  <>
                    Reviewed by: {item.reviewed_by || 'Unknown'}
                  </>
                ) : (
                  item.entity_creator?.id || 'Unknown User'
                )}
              </Header>
              <p>{renderTextPreview(item.moderation_payload?.texts)}</p>
            </GridColumn>
          </GridRow>

          {/* Divider */}
          <GridRow>
            <GridColumn width={16}>
              <div style={{ 
                borderTop: '1px solid rgba(34,36,38,.15)',
                margin: '.2rem -1rem'
              }} />
            </GridColumn>
          </GridRow>

          {/* Flags and Action Buttons Row */}
          <GridRow style={{ 
            marginTop: 0,
            paddingTop: '0.2rem'
          }}>
            <GridColumn width={10}>
              {item.flags?.map((flag, index) => (
                <span key={index} style={{
                  background: '#F0F0F0',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  marginRight: '8px',
                  fontSize: '12px'
                }}>
                  {flag.type}
                </span>
              ))}
            </GridColumn>
            <GridColumn width={6} textAlign="right">
              <Button.Group basic size="tiny">
                <Button 
                  primary 
                  basic 
                  compact 
                  style={{ padding: '8px 12px' }}
                  onClick={(e) => handleMarkReviewed(item.id, e)}
                >
                  Mark reviewed
                </Button>
                <Button 
                  color="red" 
                  basic 
                  compact 
                  style={{ padding: '8px 12px' }}
                  onClick={(e) => handleDelete(item.id, e)}
                >
                  Delete
                </Button>
              </Button.Group>
            </GridColumn>
          </GridRow>
        </Grid>
      </Segment>
    ))
  );

  const handleTabChange = (e, { activeIndex }) => {
    setActiveTab(activeIndex);
    window.scrollTo(0, 0);
  };

  return (
    <>
      {/* New Header Menu */}
      <Menu fixed="top" inverted style={{ background: '#2185d0' }}>
        <Container>
          <Menu.Item header>
            <Image 
              src="https://github.com/user-attachments/assets/8efbfb30-8bac-471a-9e65-1e00c4429d5f"
              style={{ 
                marginRight: '1.5em',
                width: '30px',
                height: 'auto'
              }} 
            />
            Stream
          </Menu.Item>
          <Menu.Item>Moderation Dashboard</Menu.Item>
        </Container>
      </Menu>

      {/* Adjust the main container to account for the fixed header */}
      <Container style={{ marginTop: '6em', marginBottom: '2em' }}>
        <Header as="h1">Moderation Dashboard</Header>
        <p style={{ color: 'grey' }}>Moderate Platform Content</p>
        
        <Tab 
          panes={[
            { 
              menuItem: 'Needs Review', 
              render: () => (
                <Tab.Pane>
                  {renderItemList(reviewQueueItems)}
                  {isLoading && (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      Loading more items...
                    </div>
                  )}
                  {!isLoading && !reviewQueueCursor && reviewQueueItems.length > 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'grey' }}>
                      No more items to load
                    </div>
                  )}
                </Tab.Pane>
              )
            },
            { 
              menuItem: 'Reviewed', 
              render: () => (
                <Tab.Pane>
                  {renderItemList(reviewedItems)}
                  {isLoading && (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      Loading more items...
                    </div>
                  )}
                  {!isLoading && !reviewedCursor && reviewedItems.length > 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'grey' }}>
                      No more items to load
                    </div>
                  )}
                </Tab.Pane>
              )
            }
          ]} 
          onTabChange={handleTabChange}
          activeIndex={activeTab}
        />

        <DetailModal 
          item={selectedItem} 
          open={isModalOpen} 
          onClose={() => {
            setIsModalOpen(false);
            setSelectedItem(null);
          }} 
        />
      </Container>
    </>
  );
}

export default App